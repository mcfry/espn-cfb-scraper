const { chromium } = require("playwright-extra")
const stealth = require("puppeteer-extra-plugin-stealth")()
chromium.use(stealth)

const fs = require("fs")

// ----------
// PASSING
// name, position, cmp, att, cmp%, yds, avg, lng, tds, int, sack, rating
// ----------

chromium.launch({ headless: true }).then(async browser => {
  const page = await browser.newPage()
  page.setDefaultTimeout(25000)

  console.log("Fetching draft order page")
  await page.goto("https://www.nflmockdraftdatabase.com/nfl-draft-order-2024", {
    waitUntil: "load"
  })
  console.log("Done")

  const NUMBER_OF_PICKS = 256
  const ROUNDS = 7
  let roundLiFound = 0

  const tableData = {}
  for (let i = 0; i < NUMBER_OF_PICKS + ROUNDS; i++) {
    console.log(`Fetching pick ${1 + i - roundLiFound}`)
    const li = await page.locator(`ul.mock-list > li:nth-child(${1 + i})`)

    let name
    const liType = await li.getAttribute("class")

    if (liType === "round-header") {
      roundLiFound += 1
      continue
    } else if (liType === "mock-list-item") {
      name = await li
        .locator(`div:nth-child(1) > a:nth-child(2)`)
        .getAttribute("href")
    }

    name = name
      .slice(12)
      .split("-")
      .map(name => name.charAt(0).toUpperCase() + name.slice(1))
      .join(" ")

    console.log(name)

    tableData[name] ||= []
    tableData[name].push(1 + i - roundLiFound)
  }

  const csvArray = []
  for (const [k, v] of Object.entries(tableData)) {
    csvArray.push([k].concat(v))
  }

  // Create the folder if it doesn't exist
  console.log(`Making csv`)
  if (!fs.existsSync("./csvs/")) {
    fs.mkdirSync("./csvs/", { recursive: true })
  }

  fs.writeFileSync(
    "./csvs/2024_draft_order.csv",
    csvArray.map(row => row.join(",")).join("\n"),
    "utf8"
  )

  await browser.close()
})
