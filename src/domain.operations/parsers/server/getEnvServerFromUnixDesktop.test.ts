import { getEnvServerFromUnixDesktop } from './getEnvServerFromUnixDesktop';

describe('getEnvServerFromUnixDesktop', () => {
  const xdgBefore = process.env.XDG_SESSION_TYPE;
  const termBefore = process.env.TERM_PROGRAM;

  afterEach(() => {
    if (xdgBefore === undefined) {
      delete process.env.XDG_SESSION_TYPE;
    } else {
      process.env.XDG_SESSION_TYPE = xdgBefore;
    }
    if (termBefore === undefined) {
      delete process.env.TERM_PROGRAM;
    } else {
      process.env.TERM_PROGRAM = termBefore;
    }
  });

  describe('positive cases', () => {
    test('returns local@unix when XDG_SESSION_TYPE is set', () => {
      delete process.env.TERM_PROGRAM;
      process.env.XDG_SESSION_TYPE = 'x11';
      const result = getEnvServerFromUnixDesktop();
      expect(result).toBe('local@unix');
      expect(result).toMatchSnapshot();
    });

    test('returns local@unix when TERM_PROGRAM is set', () => {
      delete process.env.XDG_SESSION_TYPE;
      process.env.TERM_PROGRAM = 'iTerm.app';
      const result = getEnvServerFromUnixDesktop();
      expect(result).toBe('local@unix');
      expect(result).toMatchSnapshot();
    });

    test('returns local@unix when both are set', () => {
      process.env.XDG_SESSION_TYPE = 'wayland';
      process.env.TERM_PROGRAM = 'vscode';
      const result = getEnvServerFromUnixDesktop();
      expect(result).toBe('local@unix');
      expect(result).toMatchSnapshot();
    });
  });

  describe('negative cases', () => {
    test('returns null when neither is set', () => {
      delete process.env.XDG_SESSION_TYPE;
      delete process.env.TERM_PROGRAM;
      const result = getEnvServerFromUnixDesktop();
      expect(result).toBe(null);
      expect(result).toMatchSnapshot();
    });
  });
});
