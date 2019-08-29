## gulpfile、書いてますか？

---

## Gulpの基本

- タスクランナーの一種
- ファイル単位の処理が得意
- パイプで変換処理を連鎖
  - 種々のプラグインで様々な変換を施す

---

### v3.x

```js
// gulpfile.js
const gulp = require('gulp')
const babel = require('gulp-babel')

gulp.task('transpile', () =>
  gulp.src('src/**/*.js')
    .pipe(babel())
    .pipe(gulp.dest('dist'))
)
```

```bash
$ npx gulp transpile
```

---

### v4.x

```js
// gulpfile.js
const { src, dest } = require('gulp')
const babel = require('gulp-babel')

module.exports.transpile = () =>
  src('src/**/*.js')
    .pipe(babel())
    .pipe(dest('dist'))
)
```

```bash
$ npx gulp transpile
```

publicにしたいタスクをexportするだけ。プラグインの使い方は今まで通り

---

### 並列実行

```js
const { parallel, src, dest } = require('gulp')

function css() {
  return src('src/**/*.scss')
    // 以下略
}

function js() {
  return src('src/**/*.js')
    // 以下略
}

module.exports.default = parallel(css, js)
```

---

### 直列実行

```js
const { series, src, dest } = require('gulp')

function hoge() {
  return src('src/**/*')
    // 以下略
}

function bar() {
  return src('dist/**/*')
    // 以下略
}

module.exports.default = series(hoge, bar)
```

---

## **こんなんはAPI Doc読めばわかる**

---

## なんでGulpの話を持ってきたの？

---

- 確かに、大体のbuild処理はwebpackで事足りてしまう
- とはいえ、webpackの事前・事後のタスクをシュッと書きたいことも多い

---

## 例：成果物のupload


```js
// gulpfile.js

const { src } = require('gulp')
const s3 = require('gulp-s3-upload')()

module.exports.deploy = () =>
  src(['webpack_dist/**/*', '!webpack_dist/**/*.map'])
    .pipe(s3({ bucket: 'my-s3-bucket' }))
}
```

```js
// package.json

  "scripts": {
    "bundle": "webpack --mode production",
    "deploy": "gulp deploy"
  },
```

---

### 都合よくpluginが見つからないときはどうする？

---

## 自分で書けばいいじゃない

---

### pluginの書き方

```js
const through = require('through2')

function hogePlugin() {
  function transform(file, encoding, cb) {
    if (!file.isBuffer()) return cb(null, file)
    const contentsStr = file.contents.toString()
    file.contents = Buffer.from(/* contentsStrをゴニョる */)
    this.push(file)
    cb()
  }

  return through.obj(transform)
}
```

Gulp pluginは実体ただのtransferable stream  
vinylに生えてる値も大したことないので、 細かいこと考えなきゃ↑で十分  

---

### 例：Bugsnagへの.mapファイルupload

```js
const fs = require('fs')
const path = require('path')
const through = require('through2')
const rp = require('request-promise')

function uploadMapToBugsnag() {

  const apiKey = process.env['BUGSNAG_API_KEY']
  const appVersion = process.env['CI_COMMIT_SHA']

  async function transform(file, encoding, cb) {
    const jsPath = file.path.replace(/\.map$/, '')
    const shortPath = path.relative(path.resolve(__dirname, 'dist'), jsPath)
    try {
      await rp({
        method: 'POST',
        uri: 'https://upload.bugsnag.example.com',
        formData: {
          apiKey,
          appVersion,
          minifiedUrl: `https://example.com/js/${shortPath}`,
          minifiedFile: fs.createReadStream(jsPath),
          sourceMap: fs.createReadStream(file.path),
        },
      })
      cb(null, file)
    } catch (err) {
      cb(err)
    }
  }

  return through.obj(transform)
}
```

---

### 利用側

```js
// gulpfile.js

const { src, parallel } = require('gulp')
const s3 = require('gulp-s3-upload')()

module.exports.deploy = parallel(
  () =>
    src(['webpack_dist/**/*', '!webpack_dist/**/*.map'])
      .pipe(s3({ bucket: 'my-s3-bucket' })),
  () => 
    src(['webpack_dist/**/*.map'])
      .pipe(uploadMapToBugsnag()),
)
```

---

## ...真っ当な話はここらへんまで

---

## なんでGulpの話を持ってきたの？（再）

---

## Gulpの基本

- ファイル単位の変換処理？
  - ASTベースの変換処理はxxx-loader + webpackでまかなえる
- タスクランナー？
  - 他のCLI混ざってる時点で全体のタスク制御としては使ってない
  - どっちかっていうとNPM scripts

---

### メインのbuild処理では拾えない処理がgulpfile.jsに溜まっていく

---

## 気持ち悪いものができあがることもしばしば

![yaminabe](https://1.bp.blogspot.com/-lx-43V0VcJA/Wn1V5H7yRlI/AAAAAAABKGI/D9_oMJ01FXg1GToW7D7WYHh7tQBRfAZjACLcBGAs/s800/food_yaminabe.png)

---

## ここからはアレなGulpタスクを晒して懺悔

![zange](https://3.bp.blogspot.com/-ADqhfQE62F8/Wn1Wdu4VgjI/AAAAAAABKKM/tDXXMrGiVl44xfRHgqic_IHK6J6SjiGEQCLcBGAs/s800/zange_man.png)

---

## やらかし1

---

```js
const { series, src, dest } = require('gulp')
const babel = require('gulp-babel')
const sourcemaps = require('gulp-sourcemaps')

module.exports.transpile = series(
  () =>
    src('frontend/src/**/*.+(js|jsx)')
      .pipe(sourcemaps.init())
      .pipe(babel())
      .pipe(sourcemaps.write('.'))
      .pipe(gulp.dest('frontend/src')),
  () =>
    src('backend/src/**/*.+(js|jsx)')
      .pipe(sourcemaps.init())
      .pipe(babel())
      .pipe(sourcemaps.write('.'))
      .pipe(gulp.dest('background/src')),
)
```

---

### 土下座ポイント

- srcとdest一緒
- commitする前に手元で実行すると無事死亡 :innocent:

---

### 言い訳

- 20万行くらいあるSSR + SPA構成
- ECS化した際にDockerの起動ヘルスチェックがタイムタウト
- Node.js起動時に `babel-register` してた :innocent:
- image作るときにbuild済ませておきたい

---

### babel-plugin-root-importが糞邪魔

```js
/* backend/src/server.jsx */

// ↓はrequire('../../frontend/src/containers/App') にされる
import App from '~/containers/App'

```

---

## やらかし2

---

```js
const { src, dest, parallel } = require('gulp')
const replace = require('gulp-replace')
const { prefix } = require('minimist')(process.argv.slice(2), {
  alias: { p: 'prefix' },
})

module.exports.replacePrefix = parallel(
  () =>
    src('src/**/*.+(jsx|html)')
      .pipe(
        replace(/(<img[^>]*\s+)src="([^"]*)"/g, (_, pre, url) =>
          /^https?/.test(url) ? _ : `${pre}src="${prefix}${url}"`,
        ),
      )
      .pipe(dest('src')),
  () =>
    src('src/**/*.+(scss|css)')
      .pipe(
        replace(/(url\(')([^']*)/g, (_, pre, url) =>
          /^https?/.test(url) ? _ : `${pre}${prefix}${url}`,
        ),
      )
      .pipe(dest('src')),
)
```


---

### 土下座ポイント

- srcとdestが(ry
- HTMLは正規表現でparseしちゃダメ

---

### 名著

![Image from Gyazo](https://i.gyazo.com/9f9f18a2ba7a0f16eb5998322db24ec9.png)]

---

### 言い訳

- CIでStorybookをS3へuploadしている
- base path部分を無理やり差し替えてる
  - local: `http://localhost:9001/images/hoge.png` 
  - S3: `https://bucket.example.com/<CI_COMMIT_SHA>/images/hoge.png`

---

## やらかし3

---

```js
const { src, dest } = require('gulp')

module.exports.injectPreview = () =>
  src('public/**/*.+(png|jpg|jpeg|svg)')
    .pipe(
      injectPreload({
        template: './.storybook/preview-head.template.html',
        outName: 'preview-head.html',
      }),
    )
    .pipe(dest('./.storybook'))
```

---

```js
const fs = require('fs')
const { File } = require('gulp-util')
const through = require('through2')

function injectPreload({ template, outName, prefix = '' }) {
  const links = []

  function transform(file, encoding, cb) {
    const href = `${prefix}${file.path.replace(file.base, '')}`
    links.push(`<link rel="preload" as="image" href="${href}">`)
    cb()
  }

  function flush(cb) {
    fs.readFile(template, 'utf-8', (err, content) => {
      if (err) return cb(err)
      this.push(new File({
        path: outName,
        contents: Buffer.from(links.join('\n') + '\n' + content),
      }))
      cb()
    })
  }

  return through.obj(transform, flush)
}
```

---

### 土下座ポイント

- そもそも何がしたいのか全然わからなくてごめんなさい

---

### 作りたいもの

```html
<link rel="preload" as="image" href="/images/hoge.png">
<link rel="preload" as="image" href="/images/fuga.svg">
<script>
// リソースの先読み完了を表すPromise
var _resoucesPreloaded =
  Promise.all(
    [...document.querySelectorAll('link[rel="preload"]')].map(
      link => new Promise(link.addEventListener.bind(link, 'load'))
    )
  )
</script>
```

---

### やりたいこと

- CIでStorybookのキャプチャ撮ってる
- CSSの `background-image: url(...)` が空振ることが多い
- `preload` link の `onload` で先読みの完了を待ってからキャプチャ取得させるため
  - https://github.com/Quramy/zisui#type-screenshotoptions

---

## まとめ

- gulpはbuildの事前・事後処理に向いてる
  - 「事後」の方は比較的まとも
  - 「事前」の方は気持ち悪いタスクになりがち（俺だけ？
- `"prebuild": "gulp run ..."` とか見たら注意しような！

---

# Thank you!
