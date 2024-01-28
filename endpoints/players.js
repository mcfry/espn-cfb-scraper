const { chromium } = require("playwright-extra")
const stealth = require("puppeteer-extra-plugin-stealth")()
chromium.use(stealth)

const fs = require("fs")

// ----------
// PLAYERS
// name, position, height, weight, class, birthplace, teamName
// ----------

chromium.launch({ headless: true }).then(async browser => {
  const page = await browser.newPage()
  page.setDefaultTimeout(150000)

  console.log("Fetching espn players by team")
  await page.goto("https://www.espn.com/college-football/teams", {
    waitUntil: "load"
  })
  console.log("Done")

  const players = []

  // (key%6) + 1 is row index
  // (key/6) + 1 is col index
  // key: conference name, conference size
  const confLookup = {
    0: ["American", 14],
    1: ["ACC", 14],
    2: ["Big 12", 14],
    3: ["Big Ten", 14],
    4: ["Conference USA", 9],
    5: ["FBS Independents", 4],
    6: ["Mid American", 12],
    7: ["Mountain West", 12],
    8: ["Pac-12", 12],
    9: ["SEC", 14],
    10: ["Sun Belt", 14]
  }

  for (const conferenceIndex of Object.keys(confLookup)) {
    for (let i = 0; i < confLookup[conferenceIndex][1]; i++) {
      // Get Team Name
      const teamName = await page
        .locator(
          `div.layout:nth-child(2) > div:nth-child(${
            parseInt(conferenceIndex / 6) + 1
          }) > div:nth-child(${
            (conferenceIndex % 6) + 1
          }) > div:nth-child(2) > div:nth-child(${
            i + 1
          }) > div:nth-child(1) > section:nth-child(1) > div:nth-child(2) > a:nth-child(1) > h2:nth-child(1)`
        )
        .innerText()

      console.log(
        `Scraping ${confLookup[conferenceIndex][0]} Team - ${teamName}`
      )

      // Click Team / goForward
      await page
        .locator(
          `div.layout:nth-child(2) > div:nth-child(${
            parseInt(conferenceIndex / 6) + 1
          }) > div:nth-child(${
            (conferenceIndex % 6) + 1
          }) > div:nth-child(2) > div:nth-child(${
            i + 1
          }) > div:nth-child(1) > section:nth-child(1) > div:nth-child(2) > div:nth-child(2) > span:nth-child(3) > a:nth-child(1)`
        )
        .click()

      // Offense, Defense, Special Teams
      for (let tableIndex = 1; tableIndex <= 3; tableIndex++) {
        const searchTable = await page.locator(
          `div.ResponsiveTable:nth-child(${tableIndex}) > div:nth-child(2) > div:nth-child(1) > div:nth-child(2) > table:nth-child(1) > tbody:nth-child(3)`
        )

        const trCount = await searchTable.locator("tr").count()
        for (let j = 0; j < trCount; j++) {
          const name = await page
            .locator(
              `div.ResponsiveTable:nth-child(${tableIndex}) > div:nth-child(2) > div:nth-child(1) > div:nth-child(2) > table:nth-child(1) > tbody:nth-child(3) > tr:nth-child(${
                j + 1
              }) > td:nth-child(2) > div:nth-child(1) > a:nth-child(1)`
            )
            .innerText()

          const row = []
          row.push(name)
          for (let k = 3; k <= 7; k++) {
            row.push(
              await page
                .locator(
                  `div.ResponsiveTable:nth-child(${tableIndex}) > div:nth-child(2) > div:nth-child(1) > div:nth-child(2) > table:nth-child(1) > tbody:nth-child(3) > tr:nth-child(${
                    j + 1
                  }) > td:nth-child(${k}) > div:nth-child(1)`
                )
                .innerText()
            )
          }
          row.push(teamName)

          players.push(row)
        }
      }

      console.log(`Done ${confLookup[conferenceIndex][0]} Team - ${teamName}`)

      await page.goBack()
      await page.waitForLoadState("load")
    }
  }

  // Create the folder if it doesn't exist
  console.log(`Making csv`)
  if (!fs.existsSync("./csvs/")) {
    fs.mkdirSync("./csvs/", { recursive: true })
  }

  fs.writeFileSync(
    "./csvs/2023_players.csv",
    players.map(row => row.join(",")).join("\n"),
    "utf8"
  )

  await browser.close()
})
