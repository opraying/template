## Native/JS 部署方案

本节结合我们当前的 GitHub Actions 工作流与 `scripts/ci` 中的 Nx 表面检测逻辑，给出一套同时覆盖原生（App Store / Google Play）与 JS 热更新的发布蓝图。目标是在不牺牲审核合规性的前提下，把「需要重新上架的二进制」与「仅资源更新」拆开，同时保留 main/staging/test/feat 分支的预览能力。

### 设计目标

- 原生改动（ios/android 目录、原生依赖、expo runtime bump）触发完整构建、使用现有 `deploy-native-*.yml` 流程提交至审核，待 App Store Connect / Play Console 审核完毕后由发布经理手动放量。
- JS 改动（UI、业务）走热更新通道
- 当两种改动同时存在时，以原生流程为主，但依然生成 JS update 产物供同版本 runtime 升级。
- 原生与 JS Channel 都能绑定到具体分支, 分支预览：
  - `main` 对应生产
  - `staging` 对应预生产
  - `test` 对应测试
  - `feat-*` 作为 ephemeral preview

### 现有 GitHub Actions / Nx 基线

| 组件                                                    | 作用                                                                                                                                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/ci-native-ios.yml`                   | detect/build 两阶段，使用 `scripts/ci/detect-surfaces.ts` 检测 native surface，`scripts/ci/run-ci-stage.ts --stage native-ios` 生成 `dist/native/ios-{profile}.ipa` 并上传 artifact。 |
| `.github/workflows/deploy-native-ios.yml`               | 监听 iOS Build workflow_run，拉取 `native-ios-{profile}` 压缩包后执行 `--stage deploy-native-ios`，由 Nx target 触发 EAS submit。                                                     |
| `.github/workflows/deploy-native-android.yml`           | 与 iOS 等同，调用 `--stage deploy-native-android`，上传到 Google Play。                                                                                                               |
| `.github/workflows/release.yaml`                        | 统一的 web/native 检测，负责 lint/typecheck/web build；未来的 JS update 工作流可以沿用此工作流的 `check-build` 逻辑输出。                                                             |
| `scripts/ci/detect-surfaces.ts` + `surface-detector.ts` | 基于 Nx tags 的「surface」检测，输出 `surface-native-ios` / `surface-native-android` 等布尔值。                                                                                       |
| `scripts/ci/stages.ts`                                  | 定义 `native-android`, `native-ios`, `deploy-native-*` stage，与 `run-ci-stage.ts` 组合成复用的 Nx pipeline。                                                                         |

### 指纹 + 变更分类流程

1. **Surface 检测**：沿用 `ci-native-ios.yml` 中的 `detect` job，输出 Nx 受影响项目列表。
2. **指纹对比**：新增 `fingerprint` job（所有 native workflow 共用），执行：
   ```bash
   tsx scripts/ci/native-fingerprint.ts --platform ios --output fingerprint-ios.json
   tsx scripts/ci/native-fingerprint.ts --platform android --output fingerprint-android.json
   ```
   自动根据 `NX_BASE/NX_HEAD`（或仓库 merge-base）创建 git worktree，给 worktree 注入 `node_modules/.pnpm` 与 `.expo` 的符号链接，然后调用 `@expo/fingerprint` 生成原生 runtime 哈希。便于在 CI 与本地调试时共享一份事实来源。
3. **分类输出**：`classify` job 汇总 `surface-*` 与指纹 diff：
   - `native_changed = surface-native-ios || surface-native-android || fingerprint.requiresStoreRelease`。
   - `js_changed = surface-web || surface-client || git diff` 中仅命中 JS/asset 目录。
   - 产出 `change_scope=js-only | native-only | mixed`，供后续 job 条件判断，并把指纹文件保存为 artifact，留待审核通过后溯源。

| `change_scope` | 触发条件                                               | 动作                                                                                    |
| -------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `native-only`  | 指纹 diff 或 Nx surface 表明有原生改动，JS bundle 未变 | 运行 `ci-native-*` build，触发 `deploy-native-*` 提交审核；JS update 流程跳过。         |
| `js-only`      | 指纹 diff 为 false，Nx native surface 也为 false       | 跳过原生 build；启动新建的 `deploy-js-update.yml`，构建 JS 包并推送热更新通道。         |
| `mixed`        | 原生与 JS 均有改动                                     | 执行原生流程，同时生成 JS update（用于原生审核通过后第一时间推送 runtime 相同的增量）。 |

### 通道/分支映射

| Git 分支  | 原生 build profile | Store 渠道                              | JS Update 分支/频道        | 说明                                                                                                              |
| --------- | ------------------ | --------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `main`    | `production`       | App Store Production / Play Production  | `updates/prod`             | 通过 `deploy-native-*` 自动提交，发布经理在审核通过后手动 `promote release`；JS update 在审核通过信号后自动推送。 |
| `staging` | `preview`          | TestFlight Beta / Play Internal Testing | `updates/staging`          | 全量自动发布至内部测试，同时记录指纹供下一次发布比对。                                                            |
| `test`    | `preview`          | 封闭测试轨道                            | `updates/test`             | 回归环境，通常与 staging 同步，但允许注入特定 QA 配置。                                                           |
| `feat-*`  | `preview`          | 不自动提交，Artifact 供分支 QA 下载安装 | `updates/preview/<branch>` | 通过 workflow_dispatch 可选择是否推送到 TestFlight Internal track；JS update 使用分支专属 channel，便于回滚。     |

### 流程细节

#### 1. 原生发布（Apple Store / Google Play）

1. 开发者合入 `staging`/`main` 等受控分支。
2. `ci-native-ios.yml` / `ci-native-android.yml`：
   - `detect` job 确认 surface。
   - 新增 `fingerprint` job 读取上一次发布的指纹（可存入 `gh release` 或 S3）并与当前 diff。
   - `build` job 若 `needs.classify.outputs.native_changed == 'true' && github.secret_source != 'None'` 则执行 Nx stage，上传 artifact（包含 `ipa/aab` + 指纹 json）。
3. `deploy-native-*` workflow_run 触发：
   - 下载 artifact，运行 `tsx scripts/run-ci-stage.ts --stage deploy-native-ios|android`，实际调用 EAS Submit。
   - 记录 `submissionId` 到 GitHub deployment，用作审核状态查询。
4. 审核等待：App Store Connect / Play Console 审核完成后，发布经理在评论中打 `@bot release ios@1.3.0`（未来可通过 `gh workflow run release-app-store.yml` 自动化）以执行 `eas submit --release` 或在控制台手动放量。
5. 合并完成后将 `fingerprint-<platform>.json` 存档，供下一次比较。

#### 2. JS-only 热更新

1. 创建 `deploy-js-update.yml`，仅在 `change_scope` 为 `js-only` 且 branch 属于 `main/staging/test/feat-*` 时运行。
2. Job 阶段：
   - `setup`: 复用 `.github/actions/setup`。
   - `bundle`: 运行 `nx run-many --target=update-bundle --projects=<affected>` 生成 JS bundle + assets。
   - `publish`: 运行 `npx hot-updater deploy -p <platform> -c <channel>`（由 `deploy-js-update` 自动执行），channel 映射自上表。
   - `notify`: 将 Update ID 写入 GitHub Deployment 状态，未来热更新平台接入前可先上传到 S3/CDN（占位）。
3. 预览分支：channel 命名为 `preview/<branch>`，在 PR 关闭时自动删除 channel。

#### 3. Mixed 变更

1. 走完整原生流程，将 `js update` 构建阶段放到 `ci-native-*` 的 `post-build` 步骤，确保 JS bundle 与对应 runtime 指纹一致。
2. `deploy-native-*` 成功后，`deploy-js-update` job 在 Deployment `state=approved` 钩子上触发，把相同 commit 的更新推送到 `updates/prod`，缩短上架与热更新的时间差。

### 分支预览实现要点

- `ci-native-*` 保持对 `feat-*` 分支的自动触发，Build profile 永远为 `preview`，输出 `native-{platform}-preview` artifact；团队可通过 `actions/download-artifact` + fastlane 安装包进行验证。
- 需要提交到 TestFlight/Play Internal 的特定分支，可通过 `workflow_dispatch` 覆盖 `profile=preview` 并把 branch 写入 `deploy-native-*` 的 allow 列表。
- JS 预览频道使用 `<branch>` 前缀，自动写入 `NX_PREVIEW_CHANNEL` 环境变量以保证热更新与二进制匹配。

### 整体开发迭代流程

1. **需求评估与分支策略**
   - 与 PM/Design 确认需求类型（JS-only / 原生 / mixed / hotfix）。
   - 选择起始分支：
     - `main`：生产最新环境修复。
     - `staging` / `test` / `feat/<slug>`：预览环境
     - `version-x`：旧版本热修，尤其是生产环境补丁。

2. **编码与本地校验**
   - JS-only 开发：常规 `pnpm lint`、`pnpm test`、`nx affected --target=build`。
   - 原生相关改动，建议每个大提交后执行：
     ```bash
     tsx scripts/ci/check-version-branch.ts
     tsx scripts/ci/native-fingerprint.ts --platform ios
     tsx scripts/ci/native-fingerprint.ts --platform android
     tsx scripts/run-ci-stage.ts --stage native-ios --platform macos
     tsx scripts/run-ci-stage.ts --stage native-android --platform linux
     ```
   - Mixed 改动需同时跑以上指令，并保留 `fingerprint.json`（供 PR 附件或调试）。

3. **提交前 checklist**
   - JS-only：确认 `native-fingerprint` 均返回 `false`，即可推送，等待 `⚡ JS Update` 自动部署。
   - Native / Mixed：
   - 所有场景：`pnpm lint`、`nx affected --target=typecheck`、`nx affected --target=test` 必须通过。

4. **发起 PR**
   - PR 模板建议包含：
     - 变更类型、涉及版本分支、目标渠道。
     - `fingerprint.json` 结论（或 CLI 日志）。
     - 是否需要手动审核动作（如 App Store 审核备注）。
   - PR CI 会依次触发 `CI Quality`、`🍎 iOS Build`、`🤖 Android Build`、`⚡ JS Update`（条件满足时）。

5. **合入与发布**
   - 合入 `main/staging/test` 后：
     - `ci-native-*` 根据 classifier 判定是否构建 artifact，并上传供 `deploy-native-*` 使用。
     - `deploy-native-*` 将 IPA/AAB 提交到 Store，Deployment 面板显示审核状态。
     - `deploy-js-update` 在 JS-only 或 mixed 场景下将 bundle 推送到 BRANCH_CHANNEL 登记的 channel。
     - `feat-*` 分支默认仅生成 preview artifact，需要手动触发 `deploy-*` workflow 或 `js-update` 命令。

6. **Hotfix 模式**
   - JS hotfix：切换至历史 `version-y`，cherry-pick 修复，运行 `tsx scripts/ci/js-update.ts --env production --branch version-y`。
   - Native hotfix：不允许在旧 runtime 修改，必须 bump 新 version 并走完整 native 发布流程。
