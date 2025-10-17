#!/bin/bash
# Hook that runs before each user prompt is submitted to Claude Code
# This reminds Claude to update tests and documentation when features are added/modified

# Check if the prompt mentions adding features, implementing, or modifying code
if echo "$USER_PROMPT" | grep -qiE "(add|implement|create|modify|update|fix|change).*(feature|command|function|method|component)"; then
    echo "🧪 REMINDER: When adding or modifying features, please:"
    echo "   1. Update tests in src/test/suite/"
    echo "   2. Update ARCHITECTURE.md with code locations"
    echo "   3. Update CLAUDE.md with new patterns/workflows"
    echo "   4. Update package.json if adding commands/settings"
    echo ""
fi
