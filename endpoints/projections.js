const { chromium } = require("playwright-extra")
const stealth = require("puppeteer-extra-plugin-stealth")()
chromium.use(stealth)

const fs = require("fs")

const NUMBER_OF_PAGES = 46 // set to number of pages - 1

// connection randomly drops to draftbuzz for some reason, need this
const tryRepeat = async (page, functionToTry) => {
  const retryAttempts = 10 // Adjust the number of retry attempts as needed

  for (let attempt = 1; attempt <= retryAttempts; attempt++) {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt - 1)))
      await page.reload({ waitUntil: "load" })
      return await functionToTry(page)
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message)
    }
  }
}

// ----------
// PROJECTIONS
// firstName, lastName, projection, college, forty
// ----------

chromium.launch({ headless: true }).then(async browser => {
  const page = await browser.newPage()
  page.setDefaultTimeout(150000)

  console.log("Fetching draft buzz player projections")
  await page.goto("https://www.nfldraftbuzz.com/positions/ALL/1/2024", {
    waitUntil: "load"
  })
  console.log("Done")

  let badPlayersFound = 0

  const projections = []
  for (let i = 1; i <= NUMBER_OF_PAGES; i += 1) {
    console.log(`Fetching page ${i}`)
    for (let j = 1; j <= 12; j += 1) {
      console.log(`Fetching p ${j}`)
      // const projectionRow = await page.locator(
      //   `#positionRankTable > tbody:nth-child(2) > tr:nth-child(${j})`
      // )

      const projectionRow = await tryRepeat(page, async repeatPage => {
        return await repeatPage.locator(
          `#positionRankTable > tbody:nth-child(2) > tr:nth-child(${j})`
        )
      })

      const projection = tryRepeat(page, async repeatPage => {
        return await repeatPage
          .locator(
            `#positionRankTable > tbody:nth-child(2) > tr:nth-child(${j}) > td:nth-child(1) > h6:nth-child(1) > i:nth-child(1)`
          )
          .innerText()
      })

      const forty = tryRepeat(page, async repeatPage => {
        return await repeatPage
          .locator(
            `#positionRankTable > tbody:nth-child(2) > tr:nth-child(${j}) > td:nth-child(7)`
          )
          .innerText()
      })

      // Click into player to get the information because the first table truncates names
      await projectionRow.click()
      await page.waitForLoadState("load", { timeout: 20000 }) // may need to be longer

      try {
        await page.waitForSelector("h1.text-danger", { timeout: 2000 })

        // If danger exists, go back for next or discard, no valid found
        console.log("bad player found")
        if (j < 12) {
          await tryRepeat(page, async repeatPage => {
            await repeatPage.goBack({ waitUntil: "load" })
          })
        }
        continue
      } catch {
        const urlSearchParams = new URLSearchParams(new URL(page.url()).search)
        if (urlSearchParams.get("aspxerrorpath") !== null) {
          badPlayersFound += 1
          console.log("bad player found, error path")

          if (j < 12) {
            await tryRepeat(page, async repeatPage => {
              await repeatPage.goBack({ waitUntil: "load" })
            })
          }
        } else {
          let firstName, lastName, college
          await tryRepeat(page, async repeatPage => {
            // No danger found and no bad player
            firstName = await repeatPage
              .locator(`div.player-info__name:nth-child(1) > span:nth-child(1)`)
              .innerText()

            lastName = await repeatPage
              .locator(`div.player-info__name:nth-child(1) > span:nth-child(2)`)
              .innerText()

            college = await repeatPage
              .locator(
                `div.player-info-details__item:nth-child(3) > div:nth-child(2)`
              )
              .innerText()
          })

          if (j < 12) {
            await tryRepeat(page, async repeatPage => {
              await repeatPage.goBack({ waitUntil: "load" })
            })
          }

          projections.push([
            firstName,
            lastName,
            projection - badPlayersFound,
            college,
            forty
          ])
        }
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
