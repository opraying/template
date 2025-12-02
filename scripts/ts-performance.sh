project='apps/web'

pnpm tsc -p $project/tsconfig.check.json --showConfig
pnpm tsc -p $project/tsconfig.check.json --noEmit --extendedDiagnostics --incremental false --generateTrace traceDir --generateCpuProfile ./traceDir/profile.cpuprofile
pnpm tsc -p $project/tsconfig.check.json --noEmit --traceResolution > ./traceDir/resolutions.txt
pnpm dlx @typescript/analyze-trace traceDir
