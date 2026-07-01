<!-- BEGIN DEEPSEEK-BRIDGE (managed — do not edit) -->
## DeepSeek delegation policy

You have a DeepSeek Bridge available via the `run_deepseek_task` and `ask_deepseek` MCP tools. DeepSeek runs token-heavy work on a far cheaper model so you spend fewer of your own tokens.

Prefer delegating to `run_deepseek_task` instead of doing the work yourself whenever a chore involves:
- reading or editing 3+ files, or any file over ~400 lines;
- multi-file refactors, large code generation, or mechanical edits across a codebase;
- summarizing, analyzing, or indexing large files or many files at once.

Use `ask_deepseek` for self-contained, token-heavy reasoning or explanations where no file access is needed.
Keep small, surgical, single-file edits and final review/verification in your own context.
When you delegate, scope the task with `posture` and `writePaths`, then review the returned diff/manifest rather than re-reading whole files.
<!-- END DEEPSEEK-BRIDGE -->
