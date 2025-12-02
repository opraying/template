#find . -type f -name ".env" -not -path "./.nx/*" -not -path "./dist/*" -exec sh -c 'dotenvx encrypt -fk ./.env.keys -f "$1"' _ {} \;
#find . -type f -name ".env.test" -not -path "./.nx/*" -not -path "./dist/*" -exec sh -c 'dotenvx encrypt -fk ./.env.keys -f "$1"' _ {} \;
#find . -type f -name ".env.production" -not -path "./.nx/*" -not -path "./dist/*" -exec sh -c 'dotenvx encrypt -fk ./.env.keys -f "$1"' _ {} \;

# find . -type f -name ".env" -not -path "./.nx/*" -not -path "./dist/*" -exec sh -c 'dotenvx decrypt -fk ./.env.keys -f "$1"' _ {} \;
# find . -type f -name ".env.test" -not -path "./.nx/*" -not -path "./dist/*" -exec sh -c 'dotenvx decrypt -fk ./.env.keys -f "$1"' _ {} \;
# find . -type f -name ".env.production" -not -path "./.nx/*" -not -path "./dist/*" -exec sh -c 'dotenvx decrypt -fk ./.env.keys -f "$1"' _ {} \;
