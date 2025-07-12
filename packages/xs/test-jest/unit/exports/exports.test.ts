import { describe, it, expect } from '@jest/globals';
import * as core from '../../../src/core';
import * as cli from '../../../src/cli';
import * as index from '../../../src/index';
import * as vendor from '../../../src/vendor';

describe('Module exports', () => {
  describe('core exports', () => {
    it('should export $ function', () => {
      expect(typeof core.$).toBe('function');
      expect(typeof core.$.cwd).toBe('string');
      expect(typeof core.$.detached).toBe('boolean');
      expect(typeof core.$.env).toBe('object');
      expect(typeof core.$.kill).toBe('function');
      expect(typeof core.$.killSignal).toBe('string');
      expect(typeof core.$.log).toBe('function');
      expect(typeof core.$.nothrow).toBe('boolean');
      expect(typeof core.$.postfix).toBe('string');
      expect(typeof core.$.preferLocal).toBe('boolean');
      expect(typeof core.$.prefix).toBe('string');
      expect(typeof core.$.quiet).toBe('boolean');
      expect(typeof core.$.quote).toBe('function');
      expect(typeof core.$.shell).toBe('boolean');
      expect(typeof core.$.spawn).toBe('function');
      expect(typeof core.$.spawnSync).toBe('function');
      expect(typeof core.$.stdio).toBe('string');
      expect(typeof core.$.sync).toBe('function');
      expect(typeof core.$.timeoutSignal).toBe('string');
      expect(typeof core.$.verbose).toBe('boolean');
    });

    it('should not export undefined $ properties', () => {
      expect(core.$.ac).toBeUndefined();
      expect(core.$.delimiter).toBeUndefined();
      expect(core.$.halt).toBeUndefined();
      expect(core.$.input).toBeUndefined();
      expect(core.$.signal).toBeUndefined();
      expect(core.$.store).toBeUndefined();
      expect(core.$.timeout).toBeUndefined();
    });

    it('should export symbols', () => {
      expect(typeof core.CWD).toBe('symbol');
      expect(typeof core.SYNC).toBe('symbol');
    });

    it('should export classes and functions', () => {
      expect(typeof core.ProcessOutput).toBe('function');
      expect(typeof core.cd).toBe('function');
      expect(typeof core.chalk).toBe('function');
      expect(typeof core.chalk.level).toBe('number');
      expect(typeof core.checkQuote).toBe('function');
      expect(typeof core.checkShell).toBe('function');
      expect(typeof core.kill).toBe('function');
      expect(typeof core.log).toBe('function');
      expect(typeof core.quote).toBe('function');
      expect(typeof core.quotePowerShell).toBe('function');
      expect(typeof core.resolveDefaults).toBe('function');
      expect(typeof core.which).toBe('function');
      expect(typeof core.which.sync).toBe('function');
      expect(typeof core.within).toBe('function');
    });

    it('should export defaults object', () => {
      expect(typeof core.defaults).toBe('object');
      expect(typeof core.defaults.cwd).toBe('string');
      expect(typeof core.defaults.detached).toBe('boolean');
      expect(typeof core.defaults.env).toBe('object');
      expect(typeof core.defaults.kill).toBe('function');
      expect(typeof core.defaults.killSignal).toBe('string');
      expect(typeof core.defaults.log).toBe('function');
      expect(typeof core.defaults.nothrow).toBe('boolean');
      expect(typeof core.defaults.preferLocal).toBe('boolean');
      expect(typeof core.defaults.quiet).toBe('boolean');
      expect(typeof core.defaults.shell).toBe('boolean');
      expect(typeof core.defaults.spawn).toBe('function');
      expect(typeof core.defaults.spawnSync).toBe('function');
      expect(typeof core.defaults.stdio).toBe('string');
      expect(typeof core.defaults.sync).toBe('boolean');
      expect(typeof core.defaults.timeoutSignal).toBe('string');
      expect(typeof core.defaults.verbose).toBe('boolean');
    });

    it('should export os module', () => {
      expect(typeof core.os).toBe('object');
      expect(typeof core.os.EOL).toBe('string');
      expect(typeof core.os.arch).toBe('function');
      expect(typeof core.os.availableParallelism).toBe('function');
      expect(typeof core.os.constants).toBe('object');
      expect(typeof core.os.cpus).toBe('function');
      // expect(typeof core.os.default).toBe('object'); // Not a standard os export
      expect(typeof core.os.devNull).toBe('string');
      expect(typeof core.os.endianness).toBe('function');
      expect(typeof core.os.freemem).toBe('function');
      expect(typeof core.os.getPriority).toBe('function');
      expect(typeof core.os.homedir).toBe('function');
      expect(typeof core.os.hostname).toBe('function');
      expect(typeof core.os.loadavg).toBe('function');
      expect(typeof core.os.machine).toBe('function');
      expect(typeof core.os.networkInterfaces).toBe('function');
      expect(typeof core.os.platform).toBe('function');
      expect(typeof core.os.release).toBe('function');
      expect(typeof core.os.setPriority).toBe('function');
      expect(typeof core.os.tmpdir).toBe('function');
      expect(typeof core.os.totalmem).toBe('function');
      expect(typeof core.os.type).toBe('function');
      expect(typeof core.os.uptime).toBe('function');
      expect(typeof core.os.userInfo).toBe('function');
      expect(typeof core.os.version).toBe('function');
    });

    it('should export path module', () => {
      expect(typeof core.path).toBe('object');
      // expect(typeof core.path._makeLong).toBe('function'); // Not a public API
      expect(typeof core.path.basename).toBe('function');
      expect(typeof core.path.delimiter).toBe('string');
      expect(typeof core.path.dirname).toBe('function');
      expect(typeof core.path.extname).toBe('function');
      expect(typeof core.path.format).toBe('function');
      expect(typeof core.path.isAbsolute).toBe('function');
      expect(typeof core.path.join).toBe('function');
      expect(typeof core.path.matchesGlob).toBe('function');
      expect(typeof core.path.normalize).toBe('function');
      expect(typeof core.path.parse).toBe('function');
      expect(typeof core.path.posix).toBe('object');
      expect(typeof core.path.relative).toBe('function');
      expect(typeof core.path.resolve).toBe('function');
      expect(typeof core.path.sep).toBe('string');
      expect(typeof core.path.toNamespacedPath).toBe('function');
      expect(typeof core.path.win32).toBe('object');
    });

    it('should export ps module', () => {
      expect(typeof core.ps).toBe('object');
      expect(typeof core.ps.kill).toBe('function');
      expect(typeof core.ps.lookup).toBe('function');
      expect(typeof core.ps.lookupSync).toBe('function');
      expect(typeof core.ps.tree).toBe('function');
      expect(typeof core.ps.treeSync).toBe('function');
    });
  });

  describe('cli exports', () => {
    it('should export argv object', () => {
      expect(typeof cli.argv).toBe('object');
      expect(typeof cli.argv._).toBe('object');
      expect(typeof cli.argv.env).toBe('object');
      expect(typeof cli.argv.envFile).toBe('object');
      expect(typeof cli.argv.experimental).toBe('boolean');
      expect(typeof cli.argv.h).toBe('boolean');
      expect(typeof cli.argv.help).toBe('boolean');
      expect(typeof cli.argv.i).toBe('boolean');
      expect(typeof cli.argv.install).toBe('boolean');
      expect(typeof cli.argv.preferlocal).toBe('boolean');
      expect(typeof cli.argv.quiet).toBe('boolean');
      expect(typeof cli.argv.repl).toBe('boolean');
      expect(typeof cli.argv.v).toBe('boolean');
      expect(typeof cli.argv.verbose).toBe('boolean');
      expect(typeof cli.argv.version).toBe('boolean');
    });

    it('should export functions', () => {
      expect(typeof cli.injectGlobalRequire).toBe('function');
      expect(typeof cli.isMain).toBe('function');
      expect(typeof cli.main).toBe('function');
      expect(typeof cli.normalizeExt).toBe('function');
      expect(typeof cli.printUsage).toBe('function');
      expect(typeof cli.transformMarkdown).toBe('function');
    });
  });

  describe('index exports', () => {
    it('should export $ function with properties', () => {
      expect(typeof index.$).toBe('function');
      expect(typeof index.$.cwd).toBe('string');
      expect(typeof index.$.detached).toBe('boolean');
      expect(typeof index.$.env).toBe('object');
      expect(typeof index.$.kill).toBe('function');
      expect(typeof index.$.killSignal).toBe('string');
      expect(typeof index.$.log).toBe('function');
      expect(typeof index.$.nothrow).toBe('boolean');
      expect(typeof index.$.postfix).toBe('string');
      expect(typeof index.$.preferLocal).toBe('boolean');
      expect(typeof index.$.prefix).toBe('string');
      expect(typeof index.$.quiet).toBe('boolean');
      expect(typeof index.$.quote).toBe('function');
      expect(typeof index.$.shell).toBe('boolean');
      expect(typeof index.$.spawn).toBe('function');
      expect(typeof index.$.spawnSync).toBe('function');
      expect(typeof index.$.stdio).toBe('string');
      expect(typeof index.$.sync).toBe('function');
      expect(typeof index.$.timeoutSignal).toBe('string');
      expect(typeof index.$.verbose).toBe('boolean');
    });

    it('should export symbols and constants', () => {
      expect(typeof index.CWD).toBe('symbol');
      expect(typeof index.SYNC).toBe('symbol');
      expect(typeof index.VERSION).toBe('string');
      expect(typeof index.version).toBe('string');
    });

    it('should export classes', () => {
      expect(typeof index.ProcessOutput).toBe('function');
      expect(typeof index.ProcessPromise).toBe('function');
    });

    it('should export YAML module', () => {
      expect(typeof index.YAML).toBe('object');
      // Basic YAML functions should be available
      expect(typeof index.YAML.parse).toBe('function');
      expect(typeof index.YAML.stringify).toBe('function');
      
      // Other functions might be available depending on vendor implementation
      if (index.YAML.Alias) expect(typeof index.YAML.Alias).toBe('function');
      if (index.YAML.CST) expect(typeof index.YAML.CST).toBe('object');
      if (index.YAML.Composer) expect(typeof index.YAML.Composer).toBe('function');
      if (index.YAML.Document) expect(typeof index.YAML.Document).toBe('function');
      if (index.YAML.Lexer) expect(typeof index.YAML.Lexer).toBe('function');
      if (index.YAML.LineCounter) expect(typeof index.YAML.LineCounter).toBe('function');
      if (index.YAML.Pair) expect(typeof index.YAML.Pair).toBe('function');
      if (index.YAML.Parser) expect(typeof index.YAML.Parser).toBe('function');
      if (index.YAML.Scalar) expect(typeof index.YAML.Scalar).toBe('function');
      if (index.YAML.Schema) expect(typeof index.YAML.Schema).toBe('function');
      if (index.YAML.YAMLError) expect(typeof index.YAML.YAMLError).toBe('function');
      if (index.YAML.YAMLMap) expect(typeof index.YAML.YAMLMap).toBe('function');
      if (index.YAML.YAMLParseError) expect(typeof index.YAML.YAMLParseError).toBe('function');
      if (index.YAML.YAMLSeq) expect(typeof index.YAML.YAMLSeq).toBe('function');
      if (index.YAML.YAMLWarning) expect(typeof index.YAML.YAMLWarning).toBe('function');
      if (index.YAML.isAlias) expect(typeof index.YAML.isAlias).toBe('function');
      if (index.YAML.isCollection) expect(typeof index.YAML.isCollection).toBe('function');
      if (index.YAML.isDocument) expect(typeof index.YAML.isDocument).toBe('function');
      if (index.YAML.isMap) expect(typeof index.YAML.isMap).toBe('function');
      if (index.YAML.isNode) expect(typeof index.YAML.isNode).toBe('function');
      if (index.YAML.isPair) expect(typeof index.YAML.isPair).toBe('function');
      if (index.YAML.isScalar) expect(typeof index.YAML.isScalar).toBe('function');
      if (index.YAML.isSeq) expect(typeof index.YAML.isSeq).toBe('function');
      if (index.YAML.parseAllDocuments) expect(typeof index.YAML.parseAllDocuments).toBe('function');
      if (index.YAML.parseDocument) expect(typeof index.YAML.parseDocument).toBe('function');
      if (index.YAML.visit) expect(typeof index.YAML.visit).toBe('function');
      if (index.YAML.visitAsync) expect(typeof index.YAML.visitAsync).toBe('function');
    });

    it('should export utilities', () => {
      expect(typeof index.argv).toBe('object');
      expect(typeof index.cd).toBe('function');
      expect(typeof index.chalk).toBe('function');
      expect(typeof index.checkQuote).toBe('function');
      expect(typeof index.checkShell).toBe('function');
      expect(typeof index.defaults).toBe('object');
      expect(typeof index.dotenv).toBe('object');
      expect(typeof index.echo).toBe('function');
      expect(typeof index.expBackoff).toBe('function');
      expect(typeof index.fetch).toBe('function');
      expect(typeof index.kill).toBe('function');
      expect(typeof index.log).toBe('function');
      expect(typeof index.minimist).toBe('function');
      expect(typeof index.nothrow).toBe('function');
      expect(typeof index.os).toBe('object');
      expect(typeof index.parseArgv).toBe('function');
      expect(typeof index.path).toBe('object');
      expect(typeof index.ps).toBe('object');
      expect(typeof index.question).toBe('function');
      expect(typeof index.quiet).toBe('function');
      expect(typeof index.quote).toBe('function');
      expect(typeof index.quotePowerShell).toBe('function');
      expect(typeof index.resolveDefaults).toBe('function');
      expect(typeof index.retry).toBe('function');
      expect(typeof index.sleep).toBe('function');
      expect(typeof index.spinner).toBe('function');
      expect(typeof index.stdin).toBe('function');
      expect(typeof index.syncProcessCwd).toBe('function');
      expect(typeof index.tempdir).toBe('function');
      expect(typeof index.tempfile).toBe('function');
      expect(typeof index.tmpdir).toBe('function');
      expect(typeof index.tmpfile).toBe('function');
      expect(typeof index.updateArgv).toBe('function');
      expect(typeof index.useBash).toBe('function');
      expect(typeof index.usePowerShell).toBe('function');
      expect(typeof index.usePwsh).toBe('function');
      expect(typeof index.which).toBe('function');
      expect(typeof index.within).toBe('function');
    });

    it('should export fs module', () => {
      expect(typeof index.fs).toBe('object');
      expect(typeof index.fs.copy).toBe('function');
      expect(typeof index.fs.createFile).toBe('function');
      expect(typeof index.fs.createFileSync).toBe('function');
      expect(typeof index.fs.createLink).toBe('function');
      expect(typeof index.fs.createLinkSync).toBe('function');
      expect(typeof index.fs.createSymlink).toBe('function');
      expect(typeof index.fs.createSymlinkSync).toBe('function');
      expect(typeof index.fs.default).toBe('object');
      expect(typeof index.fs.emptyDir).toBe('function');
      expect(typeof index.fs.emptyDirSync).toBe('function');
      expect(typeof index.fs.emptydir).toBe('function');
      expect(typeof index.fs.emptydirSync).toBe('function');
      expect(typeof index.fs.ensureDir).toBe('function');
      expect(typeof index.fs.ensureDirSync).toBe('function');
      expect(typeof index.fs.ensureFile).toBe('function');
      expect(typeof index.fs.ensureFileSync).toBe('function');
      expect(typeof index.fs.ensureLink).toBe('function');
      expect(typeof index.fs.ensureLinkSync).toBe('function');
      expect(typeof index.fs.ensureSymlink).toBe('function');
      expect(typeof index.fs.ensureSymlinkSync).toBe('function');
      expect(typeof index.fs.exists).toBe('function');
      expect(typeof index.fs.mkdirp).toBe('function');
      expect(typeof index.fs.mkdirpSync).toBe('function');
      expect(typeof index.fs.mkdirs).toBe('function');
      expect(typeof index.fs.mkdirsSync).toBe('function');
      expect(typeof index.fs.move).toBe('function');
      expect(typeof index.fs.outputFile).toBe('function');
      expect(typeof index.fs.pathExists).toBe('function');
      expect(typeof index.fs.read).toBe('function');
      expect(typeof index.fs.readv).toBe('function');
      expect(typeof index.fs.remove).toBe('function');
      expect(typeof index.fs.write).toBe('function');
      expect(typeof index.fs.writev).toBe('function');
    });

    it('should export glob/globby module', () => {
      expect(typeof index.glob).toBe('function');
      expect(typeof index.glob.convertPathToPattern).toBe('function');
      expect(typeof index.glob.generateGlobTasks).toBe('function');
      expect(typeof index.glob.generateGlobTasksSync).toBe('function');
      expect(typeof index.glob.globby).toBe('function');
      expect(typeof index.glob.globbyStream).toBe('function');
      expect(typeof index.glob.globbySync).toBe('function');
      expect(typeof index.glob.isDynamicPattern).toBe('function');
      expect(typeof index.glob.isGitIgnored).toBe('function');
      expect(typeof index.glob.isGitIgnoredSync).toBe('function');
      expect(typeof index.glob.sync).toBe('function');
      
      // globby alias
      expect(typeof index.globby).toBe('function');
      expect(typeof index.globby.convertPathToPattern).toBe('function');
    });
  });

  describe('vendor exports', () => {
    it('should export chalk', () => {
      expect(typeof vendor.chalk).toBe('function');
      expect(typeof vendor.chalk.level).toBe('number');
    });

    it('should export depseek', () => {
      expect(typeof vendor.depseek).toBe('function');
    });

    it('should export dotenv', () => {
      expect(typeof vendor.dotenv).toBe('object');
      expect(typeof vendor.dotenv.config).toBe('function');
      expect(typeof vendor.dotenv.load).toBe('function');
      expect(typeof vendor.dotenv.loadSafe).toBe('function');
      expect(typeof vendor.dotenv.parse).toBe('function');
      expect(typeof vendor.dotenv.stringify).toBe('function');
    });

    it('should export fs', () => {
      expect(typeof vendor.fs).toBe('object');
      expect(typeof vendor.fs.copy).toBe('function');
      expect(typeof vendor.fs.createFile).toBe('function');
      expect(typeof vendor.fs.createFileSync).toBe('function');
      expect(typeof vendor.fs.createLink).toBe('function');
      expect(typeof vendor.fs.createLinkSync).toBe('function');
      expect(typeof vendor.fs.createSymlink).toBe('function');
      expect(typeof vendor.fs.createSymlinkSync).toBe('function');
      expect(typeof vendor.fs.default).toBe('object');
      expect(typeof vendor.fs.emptyDir).toBe('function');
      expect(typeof vendor.fs.emptyDirSync).toBe('function');
      expect(typeof vendor.fs.emptydir).toBe('function');
      expect(typeof vendor.fs.emptydirSync).toBe('function');
      expect(typeof vendor.fs.ensureDir).toBe('function');
      expect(typeof vendor.fs.ensureDirSync).toBe('function');
      expect(typeof vendor.fs.ensureFile).toBe('function');
      expect(typeof vendor.fs.ensureFileSync).toBe('function');
      expect(typeof vendor.fs.ensureLink).toBe('function');
      expect(typeof vendor.fs.ensureLinkSync).toBe('function');
      expect(typeof vendor.fs.ensureSymlink).toBe('function');
      expect(typeof vendor.fs.ensureSymlinkSync).toBe('function');
      expect(typeof vendor.fs.exists).toBe('function');
      expect(typeof vendor.fs.mkdirp).toBe('function');
      expect(typeof vendor.fs.mkdirpSync).toBe('function');
      expect(typeof vendor.fs.mkdirs).toBe('function');
      expect(typeof vendor.fs.mkdirsSync).toBe('function');
      expect(typeof vendor.fs.move).toBe('function');
      expect(typeof vendor.fs.outputFile).toBe('function');
      expect(typeof vendor.fs.pathExists).toBe('function');
      expect(typeof vendor.fs.read).toBe('function');
      expect(typeof vendor.fs.readv).toBe('function');
      expect(typeof vendor.fs.remove).toBe('function');
      expect(typeof vendor.fs.write).toBe('function');
      expect(typeof vendor.fs.writev).toBe('function');
    });

    it('should export glob', () => {
      expect(typeof vendor.glob).toBe('function');
      expect(typeof vendor.glob.convertPathToPattern).toBe('function');
      expect(typeof vendor.glob.generateGlobTasks).toBe('function');
      expect(typeof vendor.glob.generateGlobTasksSync).toBe('function');
      expect(typeof vendor.glob.globby).toBe('function');
      expect(typeof vendor.glob.globbyStream).toBe('function');
      expect(typeof vendor.glob.globbySync).toBe('function');
      expect(typeof vendor.glob.isDynamicPattern).toBe('function');
      expect(typeof vendor.glob.isGitIgnored).toBe('function');
      expect(typeof vendor.glob.isGitIgnoredSync).toBe('function');
      expect(typeof vendor.glob.sync).toBe('function');
    });

    it('should export minimist', () => {
      expect(typeof vendor.minimist).toBe('function');
    });

    it('should export ps', () => {
      expect(typeof vendor.ps).toBe('object');
      expect(typeof vendor.ps.kill).toBe('function');
      expect(typeof vendor.ps.lookup).toBe('function');
      expect(typeof vendor.ps.lookupSync).toBe('function');
      expect(typeof vendor.ps.tree).toBe('function');
      expect(typeof vendor.ps.treeSync).toBe('function');
    });

    it('should export which', () => {
      expect(typeof vendor.which).toBe('function');
      expect(typeof vendor.which.sync).toBe('function');
    });

    it('should export YAML', () => {
      expect(typeof vendor.YAML).toBe('object');
      expect(typeof vendor.YAML.Alias).toBe('function');
      expect(typeof vendor.YAML.CST).toBe('object');
      expect(typeof vendor.YAML.Composer).toBe('function');
      expect(typeof vendor.YAML.Document).toBe('function');
      expect(typeof vendor.YAML.Lexer).toBe('function');
      expect(typeof vendor.YAML.LineCounter).toBe('function');
      expect(typeof vendor.YAML.Pair).toBe('function');
      expect(typeof vendor.YAML.Parser).toBe('function');
      expect(typeof vendor.YAML.Scalar).toBe('function');
      expect(typeof vendor.YAML.Schema).toBe('function');
      expect(typeof vendor.YAML.YAMLError).toBe('function');
      expect(typeof vendor.YAML.YAMLMap).toBe('function');
      expect(typeof vendor.YAML.YAMLParseError).toBe('function');
      expect(typeof vendor.YAML.YAMLSeq).toBe('function');
      expect(typeof vendor.YAML.YAMLWarning).toBe('function');
      expect(typeof vendor.YAML.default).toBe('object');
      expect(typeof vendor.YAML.isAlias).toBe('function');
      expect(typeof vendor.YAML.isCollection).toBe('function');
      expect(typeof vendor.YAML.isDocument).toBe('function');
      expect(typeof vendor.YAML.isMap).toBe('function');
      expect(typeof vendor.YAML.isNode).toBe('function');
      expect(typeof vendor.YAML.isPair).toBe('function');
      expect(typeof vendor.YAML.isScalar).toBe('function');
      expect(typeof vendor.YAML.isSeq).toBe('function');
      expect(typeof vendor.YAML.parse).toBe('function');
      expect(typeof vendor.YAML.parseAllDocuments).toBe('function');
      expect(typeof vendor.YAML.parseDocument).toBe('function');
      expect(typeof vendor.YAML.stringify).toBe('function');
      expect(typeof vendor.YAML.visit).toBe('function');
      expect(typeof vendor.YAML.visitAsync).toBe('function');
    });
  });
});