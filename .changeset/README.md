# Changesets

This directory stores "changesets" — markdown files that describe changes made in a branch or commit.

When you make changes, run `npx changeset` to create a new changeset file. It will prompt you to select the type of change (patch/minor/major) and write a description.

These files are consumed by `npx changeset version` to bump versions and update CHANGELOG.md before a release.
