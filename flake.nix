{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config = {
            allowUnfree = true;
            android_sdk.accept_license = true;
          };
        };

        inherit (pkgs) lib;

        androidComposition = pkgs.androidenv.composeAndroidPackages {
          cmdLineToolsVersion = "9.0";
          toolsVersion = "26.1.1";
          platformToolsVersion = "35.0.2";
          buildToolsVersions = [ "35.0.0" ];
          platformVersions = [ "35" ];
          includeNDK = true;
          ndkVersion = "28.1.13356709";
          cmakeVersions = [ "3.22.1" ];
          includeExtras = [
            "extras;android;m2repository"
            "extras;google;m2repository"
          ];
        };

        devPackages = with pkgs;
          lib.unique ([
            corepack
            nodejs_24
            bun
            python312
            uv
            androidComposition.androidsdk
            androidComposition.platform-tools
            androidComposition.build-tools
            androidComposition.platforms
            androidComposition.cmake
            jdk17_headless
            gradle
            watchman
          ] ++ lib.optionals stdenv.isDarwin [
            cocoapods
            ruby_3_3
            fastlane
            xcbeautify
            libimobiledevice
            ccache
          ]);

        shellHookScript = pkgs.writeShellScript "devbox-shell-hook" ''
          export NODE_ENV=development

          export PNPM_HOME="$HOME/.local/share/pnpm"
          export PATH="$PNPM_HOME:$PATH"

          export ANDROID_HOME="${androidComposition.androidsdk}/libexec/android-sdk"
          export ANDROID_SDK_ROOT="$ANDROID_HOME"
          export ANDROID_NDK_ROOT="$ANDROID_HOME/ndk-bundle"
          export PATH="$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

          export JAVA_HOME="${pkgs.jdk17_headless}"
          export PATH="$JAVA_HOME/bin:$PATH"

          export GRADLE_HOME="${pkgs.gradle}/lib/gradle"
          export PATH="$GRADLE_HOME/bin:$PATH"

          if [[ "$OSTYPE" == "darwin"* ]]; then
            export LANG=en_US.UTF-8
            export LC_ALL=en_US.UTF-8
            export DEVELOPER_DIR="/Applications/Xcode.app/Contents/Developer"
            export PATH="$DEVELOPER_DIR/Toolchains/XcodeDefault.xctoolchain/usr/bin:$DEVELOPER_DIR/usr/bin:$PATH"
            export SDKROOT="$DEVELOPER_DIR/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk"
            export MACOSX_DEPLOYMENT_TARGET="11.0"
            export IOS_DEPLOYMENT_TARGET="15.1"
            export IPHONEOS_DEPLOYMENT_TARGET="15.1"
          fi

          export PATH="$(pwd)/node_modules/.bin:$PATH"

          export NODE_OPTIONS="''${NODE_OPTIONS:+$NODE_OPTIONS }--max-old-space-size=8192"
          export GRADLE_OPTS="-Xmx4g -XX:+UseG1GC"

          export UV_CACHE_DIR="''${XDG_CACHE_HOME:-$HOME/.cache}/uv"
          export UV_PYTHON_INSTALL_DIR="$UV_CACHE_DIR/python"
          export UV_LINK_MODE=copy
          export UV_PROJECT_ENVIRONMENT="$(pwd)/.venv"
          export UV_PROJECT_PYTHON="3.12.0"

          uv_activate_project_env() {
            if [ -d "$UV_PROJECT_ENVIRONMENT" ]; then
              export VIRTUAL_ENV="$UV_PROJECT_ENVIRONMENT"
              export PATH="$VIRTUAL_ENV/bin:$PATH"
              if [ -f "$VIRTUAL_ENV/bin/activate" ]; then
                # shellcheck disable=SC1090
                . "$VIRTUAL_ENV/bin/activate"
              fi
            fi
          }

        uv_prepare_project_env() {
            local current_version
            if [ -f "$UV_PROJECT_ENVIRONMENT/pyvenv.cfg" ]; then
                current_version="$(grep -E '^version_info' "$UV_PROJECT_ENVIRONMENT/pyvenv.cfg" | awk -F ' = ' '{print $2}')"
                if [ "''${current_version:-}" != "$UV_PROJECT_PYTHON" ]; then
                    rm -rf "$UV_PROJECT_ENVIRONMENT"
                fi
            fi

            if [ ! -d "$UV_PROJECT_ENVIRONMENT" ]; then
                uv venv --python "$UV_PROJECT_PYTHON"
            fi

            uv python pin "$UV_PROJECT_PYTHON" --project >/dev/null 2>&1 || true
        }

        uv_prepare_project_env
        uv_activate_project_env

        alias pip="uv pip"
        alias pip-sync="uv pip sync"

          devbox_debug_env() {
            echo "=== Development Environment ==="

            echo "Android SDK:"
            echo "  SDK Root: $ANDROID_HOME"
            echo "  NDK Root: $ANDROID_NDK_ROOT"
            echo "  SDK Version: $(sdkmanager --version 2>/dev/null || echo 'N/A')"
            echo "  Platform Tools: $(adb version 2>/dev/null | head -n1 || echo 'N/A')"
            echo "  Build Tools: $(ls -1 $ANDROID_HOME/build-tools 2>/dev/null | sort -V | tail -n1 || echo 'N/A')"
            echo "  Platform: Android $(ls -1 $ANDROID_HOME/platforms 2>/dev/null | grep -o '[0-9]*' | sort -V | tail -n1 || echo 'N/A')"
            echo "  NDK Version: $(ls -1 $ANDROID_HOME/ndk 2>/dev/null | sort -V | tail -n1 || echo 'N/A')"

            if [[ "$OSTYPE" == "darwin"* ]]; then
              echo "iOS Environment:"
              echo "  Xcode Version: $(xcodebuild -version 2>/dev/null | head -n1 || echo 'N/A')"
              echo "  GCC Version: $(gcc --version 2>/dev/null | head -n1 || echo 'N/A')"
              echo "  Clang Version: $(clang --version 2>/dev/null | head -n1 || echo 'N/A')"
              echo "  CocoaPods Version: $(pod --version 2>/dev/null || echo 'N/A')"
              echo "  Ruby Version: $(ruby --version 2>/dev/null || echo 'N/A')"
              echo "  Deployment Target: $IOS_DEPLOYMENT_TARGET"
            fi

            echo "Common Environment:"
            echo "  Node Version: $(node --version 2>/dev/null || echo 'N/A')"
            echo "  NPM Version: $(npm --version 2>/dev/null || echo 'N/A')"
            echo "  PNPM Version: $(pnpm --version 2>/dev/null || echo 'N/A')"
            echo "  UV Version: $(uv --version 2>/dev/null | head -n1 || echo 'N/A')"
            if [ -n "$VIRTUAL_ENV" ]; then
              echo "  Active Python Env: $VIRTUAL_ENV"
            fi
            echo "  Python Version: $(python3 --version 2>/dev/null || echo 'N/A')"
            echo "  Java Version: $(java -version 2>&1 | head -n1 || echo 'N/A')"
            echo "  Gradle Version: $(gradle --version 2>/dev/null | grep Gradle | head -n1 || echo 'N/A')"
            echo "====================================="
          }
        '';
      in
      {
        devShells.default = pkgs.mkShell {
          name = "DevBox";
          buildInputs = devPackages;
          shellHook = "source ${shellHookScript}";
        };
      }
    );
}
