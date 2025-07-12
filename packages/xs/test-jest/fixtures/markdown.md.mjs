// # Markdown
// 
// ignore
// 
// >
// > ```
// > echo ignore
// > ```
// 

await $`whoami`
await $`echo ${__dirname}`

// 

await $`echo "tilde"`

// 

console.log(chalk.yellowBright(__filename))

// 

await import('chalk')

// 
await $`
VAR=$(echo hello)
echo "$VAR"
`
// 
    // ignore
    console.log('world')

// Other code blocks are ignored:
// 

// .ignore {}

// 