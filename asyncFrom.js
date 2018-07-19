const puppeteer = require('puppeteer');
var readline = require('readline-sync');
const cheerio = require('cheerio');
var Excel = require('exceljs');
let userInput,
  isStart = false;

async function initPupp(url) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  return { page, browser, url };
}

async function gotoPage(pageInfo) {
  await pageInfo.page.goto(pageInfo.url, { waitUntil: 'networkidle2' });
  await pageInfo.page.setViewport({
    width: 1248,
    height: 1024,
  });

  return pageInfo;
}

async function searchForm(pageInfo) {
  const inputForm = await pageInfo.page.$('#search-input');
  await inputForm.type(userInput);
  await inputForm.press('Enter');

  await pageInfo.page.waitFor(1000);

  return pageInfo;
}

async function pageControl(pageInfo) {
  let contents = [];
  while (1) {
    pageInfo = await getPaging(pageInfo);
    contents = contents.concat(await getContent(pageInfo));

    if (
      pageInfo.paging.next.get(0).tagName !== 'a' &&
      pageInfo.paging.lastChild.get(0).tagName !== 'a'
    ) {
      console.log('====================================');
      console.log('END DATA');
      console.log('====================================');
      break;
    }
    pageInfo.page.click('div.paginate.loaded > strong + a', { delay: 150 });
    await pageInfo.page.waitFor(1000);
  }

  makeExcel(contents, pageInfo);
}
async function getPaging(pageInfo) {
  let $ = cheerio.load(await pageInfo.page.content());
  pageInfo.paging = {
    curPage: $('div.paginate.loaded > strong').text(),
    nextCurPage: $('div.paginate.loaded > strong + a'),
    next: $('div.paginate.loaded > .next'),
    lastChild: $('div.paginate.loaded > .last-child'),
  };

  return pageInfo;
}

async function getContent(pageInfo) {
  let buffer = [];
  let $ = cheerio.load(await pageInfo.page.content());

  $(
    '#panel > div.panel_content.nano.has-scrollbar > div.scroll_pane.content > div.panel_content_flexible > div.search_result > ul > li'
  ).each(function(i, ele) {
    let element = $(ele).find('div.lsnx > dl');

    buffer.push({
      title: $(element)
        .find('dt > a')
        .text(),
      addr: $(element)
        .find('dd.addr')
        .text(),
      tel: $(element)
        .find('dd.tel')
        .text()
        .trim(),
    });
  });

  // console.log('====================================');
  // console.log('buffer :', buffer);
  // console.log('====================================');
  return buffer;
}

async function makeExcel(data, pageInfo) {
  var workbook = new Excel.Workbook();
  var worksheet = workbook.addWorksheet('Result');

  worksheet.columns = Object.keys(data[0]).map(function(v, i) {
    return {
      header: v.charAt(0).toUpperCase() + v.slice(1),
      key: v,
    };
  });

  worksheet.addRows(data);

  workbook.xlsx.writeFile(userInput + '.xlsx').then(function() {
    console.log('saved');
  });

  pageInfo.browser.close();
}

userInput = readline.question('검색어 입력 (종료는 Ctrl+c) > ');
if (userInput.trim().length > 0) {
  initPupp('https://map.naver.com')
    .then(pageInfo => gotoPage(pageInfo))
    .then(pageInfo => searchForm(pageInfo))
    .then(pageInfo => pageControl(pageInfo));
}
