# /mate Command

Dispatch background research tasks to a subagent.

## Usage
- `/mate research <topic>` — Start background research on a topic

## Implementation

1. Parse the subcommand. Currently only `research` is supported.

2. Extract the topic from the remaining arguments.

3. Launch the `research-mate` subagent with the topic as context:
   - The subagent runs in a separate context
   - It performs web search and summarization
   - Results are saved to /tmp/cfm-research-output.md

4. When the subagent completes, the TeammateIdle hook fires,
   which plays the `subagent_done` notification.

5. The user can then ask about the research results. The main
   Claude session can read /tmp/cfm-research-output.md.

6. If no topic provided, show usage help.
