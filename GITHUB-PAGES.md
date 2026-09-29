# GitHub Pages hosting

RobotForge has a separate static build for GitHub Pages. It uses the same editors, project schema, checkpoints, source generators, and deployment UI as the server-hosted app. The existing server build is retained.

## Build and test

Use Node.js 22.13 or newer:

```sh
npm ci
npm run build:pages
npm run test:pages
npm run preview:pages
```

The build packages Companion 1.3.1, fetches and validates the official library feeds, and writes `dist-pages/`. It does not require a running backend. The default URL prefix is `/robotforge/`; `ROBOTFORGE_PAGES_BASE=/` supports hosting at the root of a custom domain. A custom domain also requires updating the companion's exact allowed origin and repackaging it.

For an offline preview, use `npm run build:pages -- --offline`. Its catalog is explicitly marked as bundled, with the original verification date. This is not the deployment command.

## Publication is opt-in

The proposed destination is `https://seedpaul.github.io/robotforge/`. Preparing this branch does not enable Pages or change the existing private Site. Publication requires approval to make the website public.

Once approved:

1. Merge the Pages changes into `main`.
2. Enable GitHub Pages for `seedpaul/robotforge`, using **GitHub Actions** as its source.
3. Set the repository Actions variable `ROBOTFORGE_PAGES_ENABLED` to `true`.
4. Run the **RobotForge Pages** workflow and verify its deployment succeeds.

The workflow tests pull requests but only deploys from `main` when the variable is enabled. Subsequent pushes publish automatically. The hourly schedule at minute 17 refreshes the catalog and rebuilds; scheduled jobs do no work while publication is disabled. Permissions to deploy are restricted to the deploy job, and third-party actions are pinned to verified commits.

The source repository remains private. GitHub Pages from a private personal repository requires GitHub Pro or another eligible plan; the account API did not reveal the current plan. The Pages website is public even when its source repository is private. A privately accessible Pages site requires an eligible GitHub Enterprise Cloud organization. Do not make this source repository public as a workaround without the owner's explicit approval.

## Library updates

Pages cannot run `/api/libraries`. The build checks the same approved upstream feeds and publishes `library-catalog.json`. The browser reads that static catalog on opening, hourly while open, on reconnect, and when **Check now** is used. It displays when publishers were actually checked. **Check now** does not start a GitHub workflow or contact the publishers from the browser.

GitHub schedules can be delayed or dropped. Catalogs older than 24 hours show a warning. Partial feed failures are reported; projects keep their saved versions and never downgrade. If all upstream checks fail, the build fails before publication and the previous deployed website remains available. Online companion builds continue checking publishers directly. Frozen projects still use their captured versions.

GitHub Actions usage is subject to the account's included minutes and spending settings. A free public educational tool can fit Pages; commercial SaaS hosting is outside GitHub Pages' permitted use.

## Robot deployment and data

Teams still run the local companion on their laptop. GitHub Pages neither compiles robot binaries nor connects to a roboRIO. Companion 1.3.1 accepts the existing Site origin and `https://seedpaul.github.io`, with the same pairing token, Host validation, build verification, and explicit deployment confirmation. Origins on GitHub Pages are shared across an account's project sites; keep other content on that account trusted. No wildcard origins are allowed.

Browser storage is tied to the website's origin. Before moving, download **Save backup** for the current project and **Development → Download history** from the old Site. Import both into the new address. The migration does not upload local robot configurations or checkpoints to GitHub, and a public editor does not make a user's browser storage public. It provides no cloud team synchronization or sign-in gate.

## References

- [What GitHub Pages hosts and plan eligibility](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Public visibility, even from private repositories](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
- [Private Pages requirements](https://docs.github.com/en/enterprise-cloud@latest/pages/getting-started-with-github-pages/changing-the-visibility-of-your-github-pages-site)
- [Pages usage limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- [GitHub Actions scheduling](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
