const { chromium } = require("playwright-extra")
const stealth = require("puppeteer-extra-plugin-stealth")()
chromium.use(stealth)

const fs = require("fs")

// ----------
// PROJECTIONS
// firstName, lastName, projection, college, forty
// ----------

chromium.launch({ headless: true }).then(async browser => {
  const page = await browser.newPage()
  page.setDefaultTimeout(45000)

  console.log("Fetching draft buzz player projections")
  await page.goto("https://www.nfldraftbuzz.com/positions/ALL/1/2024", {
    waitUntil: "load"
  })
  console.log("Done")

  const projections = []
  for (let i = 1; i <= 54; i += 1) {
    console.log(`Fetching page ${i}`)
    for (let j = 1; j <= 12; j += 1) {
      console.log(`Fetching p ${j}`)
      const projectionRow = await page.locator(
        `#positionRankTable > tbody:nth-child(2) > tr:nth-child(${j})`
      )

      const projection = await page
        .locator(
          `#positionRankTable > tbody:nth-child(2) > tr:nth-child(${j}) > td:nth-child(1) > h6:nth-child(1) > i:nth-child(1)`
        )
        .innerText()

      const forty = await page
        .locator(
          `#positionRankTable > tbody:nth-child(2) > tr:nth-child(${j}) > td:nth-child(7)`
        )
        .innerText()

      // Click into player to get the information because the first table truncates names
      projectionRow.click()
      await page.waitForLoadState("load")

      try {
        // If doesn't exist, discard
        await page.waitForSelector("h1.text-danger", { timeout: 1500 })
        if (j < 12) {
          page.goBack()
          await page.waitForLoadState("load")
        }
        continue
      } catch {
        // No error
        const firstName = await page
          .locator(`div.player-info__name:nth-child(1) > span:nth-child(1)`)
          .innerText()

        const lastName = await page
          .locator(`div.player-info__name:nth-child(1) > span:nth-child(2)`)
          .innerText()

        const college = await page
          .locator(
            `div.player-info-details__item:nth-child(3) > div:nth-child(2)`
          )
          .innerText()

        if (j < 12) {
          page.goBack()
          await page.waitForLoadState("load")
        }

        projections.push([firstName, lastName, projection, college, forty])
      }
    }

    await page.goto(
      `https://www.nfldraftbuzz.com/positions/ALL/${i + 1}/2024`,
      {
        waitUntil: "load"
      }
    )
  }

  // Create the folder if it doesn't exist
  console.log(`Making csv`)
  if (!fs.existsSync("./csvs/")) {
    fs.mkdirSync("./csvs/", { recursive: true })
  }

  fs.writeFileSync(
    "./csvs/2024_projections.csv",
    projections.map(row => row.join(",")).join("\n"),
    "utf8"
  )

  await browser.close()
})
