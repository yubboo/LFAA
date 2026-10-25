# `lfaa-tool-terminal`

Agent tool adapter for the existing local `TerminalService` PTY. It does not create a second Shell, permission, sandbox, or persistence owner.

## Actions

- `create`: starts a terminal in the requested working directory (or the configured task folder) and binds it to the current account and Agent Run.
- `send`: writes `input` exactly as provided. Set `submit: true` to send Enter in the same tool call and permission decision. The adapter appends one carriage return only when the text does not already end in CR or LF. Leave `submit` unset when typing an incomplete command or multiline input.
- `read`: returns the existing bounded PTY output buffer.
- `close`: terminates the current Run's terminal process tree.

All command input remains a dangerous terminal action handled by the existing Permission Owner. `submit` only represents the Enter key; it does not parse, authorize, or retry a command. Sessions remain bound to their creating account and Run and are closed when that Run is disposed.
