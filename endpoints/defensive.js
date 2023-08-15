const { chromium } = require("playwright-extra")
const stealth = require("puppeteer-extra-plugin-stealth")()
chromium.use(stealth)

const fs = require("fs")

// ----------
// DEFENSIVE
// name, position, solo, ast, total | sack, sack_yds | pd, int, int_yds,
// long, tds | ff
// ----------

chromium.launch({ headless: true }).then(async browser => {
  const page = await browser.newPage()
  page.setDefaultTimeout(60000)

  console.log("Fetching espn defensive page, sorted desc by tackles")
  await page.goto(
    "https://www.espn.com/college-football/stats/player/_/view/defense/table/defensive/sort/totalTackles/dir/desc",
    { waitUntil: "load" }
  )
  console.log("Done")

  // Select thead > tr of second/inner table
  const colCount = await page
    .locator("thead.Table__header-group:nth-child(6) > tr:nth-child(2)")
    .locator("th")
    .count()

  const tableData = {}
  const fetchPage = async pageNumber => {
    for (let i = pageNumber * 50; i < pageNumber * 50 + 50; i++) {
      try {
        // Select <a> tag of first/outer table
        const name = await page
          .locator(
            `tbody.Table__TBODY:nth-child(3) > tr:nth-child(${
              i + 1
            }) > td:nth-child(2) > div:nth-child(1) > a`
          )
          .innerText()

        tableData[name] = []
        for (let j = 0; j < colCount; j++) {
          // Select the jth <td> in the ith <tr> of second/inner table
          const data = await page
            .locator("tbody.Table__TBODY:nth-child(7)")
            .locator("tr")
            .nth(i)
            .locator("td")
            .nth(j)
            .innerText()

          tableData[name].push(data.replace(/,/g, ""))
        }
      } catch (error) {
        return false
      }
    }

    return true
  }

  let pageNumber = 0
  console.log("Scraping page 1")
  while (pageNumber < 80 && (await fetchPage(pageNumber))) {
    try {
      await page
        .locator(
          "div.layout:nth-child(1) > div:nth-child(1) > section:nth-child(1) > div:nth-child(1)"
        )
        .locator("div.tc")
        .locator(".loadMore__link")
        .click()
      pageNumber += 1
      console.log(`Scraping page ${pageNumber + 1}`)
    } catch (error) {
      console.log("No button found, end of table")
    }
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
    "./csvs/2023_defensive.csv",
    csvArray.map(row => row.join(",")).join("\n"),
    "utf8"
  )

  await browser.close()
})
