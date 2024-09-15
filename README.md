# Autotag action

[![Unofficial Support](https://img.shields.io/badge/Pantheon-Unofficial_Support-yellow?logo=oobook&color=FFDC28)](https://docs.pantheon.io/oss-support-levels#unofficial-support)
[![Lint](https://github.comoobook/automated-tag/actions/workflows/lint.yml/badge.svg)](https://github.comoobook/automated-tag/actions/workflows/lint.yml)
[![Autotag and Release](https://github.comoobook/automated-tag/actions/workflows/tag-release.yml/badge.svg)](https://github.comoobook/automated-tag/actions/workflows/tag-release.yml)
[![MIT License](https://img.shields.io/github/licenseoobook/automated-tag)](https://github.comoobook/automated-tag/blob/main/LICENSE)
[![GitHub release (latest by date)](https://img.shields.io/github/v/releaseoobook/automated-tag)](https://github.comoobook/automated-tag/releases)

A GitHub action that implements [pantheon-systems/autotag](https://github.com/pantheon-systems/autotag).

## What's it do?

This action will automatically create a new tag and release for your repository when a pull request is merged to the default branch. It will also create a changelog entry for the new tag and release.

This action is currently experimental.

## Inputs

### `gh-token`

A GitHub token with `repo` scope. This is used to create the tag and release.

### Usage

```yaml
name: Autotag and Release
on:
  push:
    branches:
      - main

permissions:
  contents: write

jobs:
  tag-release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oobook/automated-tag@v0
        with:
          gh-token: ${{ github.token }}
```
