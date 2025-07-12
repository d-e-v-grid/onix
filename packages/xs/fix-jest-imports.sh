#!/bin/bash

# Fix imports in jest test files
find test-jest -name "*.test.ts" -o -name "*.test.js" | while read file; do
  echo "Fixing imports in $file"
  
  # Replace ../../../build/ with ../../../src/
  sed -i '' "s|from '\.\./\.\./\.\./build/|from '../../../src/|g" "$file"
  
  # Remove .js extensions from imports
  sed -i '' "s|from '\(.*\)\.js'|from '\1'|g" "$file"
done

# Fix helper imports
find test-jest/helpers -name "*.ts" -o -name "*.js" | while read file; do
  echo "Fixing imports in $file"
  
  # Replace ../../build/ with ../../src/
  sed -i '' "s|from '\.\./\.\./build/|from '../../src/|g" "$file"
  
  # Remove .js extensions from imports
  sed -i '' "s|from '\(.*\)\.js'|from '\1'|g" "$file"
done

echo "Import fixes completed!"