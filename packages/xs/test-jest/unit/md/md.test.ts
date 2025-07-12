import { describe, it, expect } from '@jest/globals';
import { transformMarkdown } from '../../../src/md';

describe('Markdown transformation', () => {
  describe('transformMarkdown()', () => {
    it('should handle newlines', () => {
      expect(transformMarkdown('\n')).toBe('// \n// ');
    });

    it('should preserve whitespace-only lines', () => {
      expect(transformMarkdown('  \n    ')).toBe('  \n    ');
    });

    it('should handle code blocks with language specifier', () => {
      const input = `
\t~~~js
console.log('js')`;
      
      const expected = `// \n\t~~~js\n// console.log('js')`;
      
      expect(transformMarkdown(input)).toBe(expected);
    });

    it('should transform complex markdown with multiple code blocks', () => {
      const input = `
# Title
    
~~~js
await $\`echo "js"\`
~~~

typescript code block
~~~~~ts
await $\`echo "ts"\`
~~~~~

~~~
unknown code block
~~~

~~~sh
echo foo
~~~

`;

      const expected = `// 
// # Title
//     

await $\`echo "js"\`

// 
// typescript code block

await $\`echo "ts"\`

// 

// unknown code block

// 
await $\`
echo foo
\`
// 
// `;

      expect(transformMarkdown(input)).toBe(expected);
    });

    it('should comment out non-code content', () => {
      const input = `# Heading
Some text
More text`;
      
      const result = transformMarkdown(input);
      
      expect(result).toContain('// # Heading');
      expect(result).toContain('// Some text');
      expect(result).toContain('// More text');
    });

    it('should extract JavaScript code blocks', () => {
      const input = `
\`\`\`js
const x = 42;
console.log(x);
\`\`\`
`;
      
      const result = transformMarkdown(input);
      
      expect(result).toContain('const x = 42;');
      expect(result).toContain('console.log(x);');
      expect(result).not.toContain('// const x = 42;');
    });

    it('should extract TypeScript code blocks', () => {
      const input = `
\`\`\`ts
const x: number = 42;
console.log(x);
\`\`\`
`;
      
      const result = transformMarkdown(input);
      
      expect(result).toContain('const x: number = 42;');
      expect(result).toContain('console.log(x);');
    });

    it('should transform shell code blocks to $ template literals', () => {
      const input = `
\`\`\`sh
echo "Hello"
ls -la
\`\`\`
`;
      
      const result = transformMarkdown(input);
      
      expect(result).toContain('await $`');
      expect(result).toContain('echo "Hello"');
      expect(result).toContain('ls -la');
      expect(result).toContain('`');
    });

    it('should handle bash code blocks like shell', () => {
      const input = `
\`\`\`bash
echo "Bash script"
\`\`\`
`;
      
      const result = transformMarkdown(input);
      
      expect(result).toContain('await $`');
      expect(result).toContain('echo "Bash script"');
    });

    it('should comment out code blocks with unknown languages', () => {
      const input = `
\`\`\`python
print("Python code")
\`\`\`

\`\`\`ruby
puts "Ruby code"
\`\`\`
`;
      
      const result = transformMarkdown(input);
      
      expect(result).toContain('// print("Python code")');
      expect(result).toContain('// puts "Ruby code"');
    });

    it('should handle code blocks without language specification', () => {
      const input = `
\`\`\`
generic code block
\`\`\`
`;
      
      const result = transformMarkdown(input);
      
      expect(result).toContain('// generic code block');
    });

    it('should handle nested code fence markers', () => {
      const input = `
\`\`\`\`js
console.log('nested');
\`\`\`\`
`;
      
      const result = transformMarkdown(input);
      
      expect(result).toContain("console.log('nested');");
    });

    it('should preserve empty lines in code blocks', () => {
      const input = `
\`\`\`js
line1();

line2();
\`\`\`
`;
      
      const result = transformMarkdown(input);
      
      expect(result).toContain('line1();\n\nline2();');
    });

    it('should handle inline code spans', () => {
      const input = 'Use `npm install` to install dependencies';
      
      const result = transformMarkdown(input);
      
      expect(result).toBe('// Use `npm install` to install dependencies');
    });

    it('should handle markdown lists', () => {
      const input = `
- Item 1
- Item 2
  - Nested item
`;
      
      const result = transformMarkdown(input);
      
      expect(result).toContain('// - Item 1');
      expect(result).toContain('// - Item 2');
      expect(result).toContain('//   - Nested item');
    });

    it('should handle empty input', () => {
      expect(transformMarkdown('')).toBe('');
    });

    it('should handle code blocks at the start', () => {
      const input = `\`\`\`js
console.log('start');
\`\`\``;
      
      const result = transformMarkdown(input);
      
      expect(result.trim()).toMatch(/^console\.log/);
    });

    it('should handle code blocks at the end', () => {
      const input = `Some text
\`\`\`js
console.log('end');
\`\`\``;
      
      const result = transformMarkdown(input);
      
      expect(result).toContain('// Some text');
      expect(result.trim()).toMatch(/console\.log\('end'\);$/);
    });
  });
});