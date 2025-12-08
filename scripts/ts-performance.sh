project='apps/web'

tsc -p $project/tsconfig.check.json --showConfig
tsc -p $project/tsconfig.check.json --noEmit --extendedDiagnostics --incremental false --generateTrace traceDir --generateCpuProfile ./traceDir/profile.cpuprofile
tsc -p $project/tsconfig.check.json --noEmit --traceResolution > ./traceDir/resolutions.txt
pnpm dlx @typescript/analyze-trace traceDir
