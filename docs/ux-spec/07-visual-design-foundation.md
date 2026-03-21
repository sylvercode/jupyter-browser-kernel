# Visual Design Foundation

### Color System

MVP uses VS Code semantic theming with no hardcoded palette.

**Status color semantics (token-first):**

- Connected: success or active semantic state
- Connecting: in-progress semantic state
- Error: error semantic state
- Disconnected: inactive semantic state

Color is supplemental only; text labels carry primary meaning.

### Typography System

Typography remains fully native to VS Code.

- Use concise labels and structured headings in output blocks.
- Preserve monospace readability for code-adjacent values and stack excerpts.

### Spacing and Layout Foundation

- Keep run input and run outcome visually close.
- Prioritize scannability over decorative containers.
- Use progressive disclosure for lower-priority details such as stack depth.

### Accessibility Considerations

- Rely on host semantics and theme compatibility.
- Do not use color as the sole state channel.
- Preserve keyboard-first workflows for major actions.
