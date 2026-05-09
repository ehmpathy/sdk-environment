import { getCommit } from './getCommit';

const [, , cmd, subcmd] = process.argv;

if (cmd === 'get' && subcmd === 'commit') {
  getCommit();
} else {
  process.stderr.write('unknown command\n');
  process.exit(2);
}
