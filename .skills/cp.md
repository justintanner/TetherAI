# Skill: /cp - Commit and Push

## Description

Commit all changes (including unstaged) and push to the remote repository.

## Usage

```
/cp [message]
```

If no message is provided, uses "Update files" as default.

## Implementation

When this skill is invoked, execute the following git commands:

1. Stage all changes (including untracked files):

   ```bash
   git add -A
   ```

2. Commit with the provided message or default:

   ```bash
   git commit -m "[message]"
   ```

3. Push to the current branch:
   ```bash
   git push
   ```

## Example

User: /cp "Fix authentication bug"

Agent executes:

```bash
git add -A
git commit -m "Fix authentication bug"
git push
```

Output: "Committed and pushed: Fix authentication bug"

## Error Handling

- If there are no changes to commit, inform the user
- If commit fails due to hook issues, show the error and suggest fixes
- If push fails (e.g., diverged branch), suggest pulling first
