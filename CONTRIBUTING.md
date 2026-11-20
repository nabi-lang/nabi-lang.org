# Contributing

This repository is the generator of nabi-lang.org and docs.nabi-lang.org,
written in Nabi. It reads the docs, www and spec repositories and the
standard-library sources, and checks every internal link and code block; see
the README for the full build.

## Development

```sh
npm ci && npm run build   # the page scripts, before any nabi build
nabi run -- check         # build; exit 1 on a broken link or a failing code block
nabi test
npm run check             # tsc
nabi fmt --check
```

## Submitting

Open a pull request against `main` with the checks above passing.

## Sign your work

Nabi uses the [Developer Certificate of Origin 1.1](https://developercertificate.org/)
(DCO) instead of a CLA. By adding a `Signed-off-by` line to a commit you
certify that you wrote the change, or otherwise have the right to submit it
under this repository's license. `git commit -s` adds the line:

```text
Signed-off-by: Your Name <you@example.com>
```

Use your name and an email you can be reached at; the email must be the
commit's author email. The `DCO / Check sign-off` check fails a pull request with an
unsigned commit. To fix it, run `git commit --amend -s` (last commit) or
`git rebase --signoff main` (every commit), then push again. The full text
of the DCO is in the
[organization's CONTRIBUTING.md](https://github.com/nabi-lang/.github/blob/main/CONTRIBUTING.md#developer-certificate-of-origin).
