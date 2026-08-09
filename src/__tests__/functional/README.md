## Functional Tests

In this project functional test the full page functional but with external APIs mocked out.
They differ from unit tests in that they 1) can use a local database for testing queries and 2) test higher level things like entire pages.


Functional tests use:
* Playwright for writing the tests
* [Nextjs Experimental test mode for Playwright](https://github.com/vercel/next.js/blob/e631396891ad55f6bc2e0da486b57f50fc4c5e3e/packages/next/src/experimental/testmode/playwright/README.md)
* Should never call the real GitHub/Codeberg API, use `msw` for mocking/stubbing API calls instead


To run the functional tests run: `pnpm functional-test`
