# Neosrc

A unified UI for Git forges like GitHub and Codeberg.

Browse repositories, follow issues, and review pull requests in one consistent interface. Your projects stay on their existing forge. Neosrc is fully open source.

## Project status

Early development. Many things are rough or missing.

## How it works

Choose a provider on the landing page to sign in with GitHub or Codeberg, then link additional accounts from your profile.
Your dashboard brings together recent issues and pull requests from linked accounts.
Repository routes use `/gh/{owner}/{repo}` for GitHub and `/cb/{owner}/{repo}` for Codeberg, with familiar paths such as `/issues` and `/pull/{number}`.

## Contributing

PRs and issues welcome.

