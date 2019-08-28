const fs = require('fs')
const path = require('path')
const through = require('through2')
const { log } = require('gulp-util')
const rp = require('request-promise')

function uploadSourceMapToBugsnag() {

  const apiKey = process.env['BUGSNAG_API_KEY']
  const appVersion = process.env['CI_COMMIT_SHA']

  async function transform(file, encoding, cb) {
    const jsPath = file.path.replace(/.map$/, '')
    if (fs.existsSync(jsPath)) {
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
        log(`uploaded sourcemap for ${shortPath}`)
        cb()
      } catch (err) {
        cb(err)
      }
    } else {
      cb()
    }
  }

  return through.obj(transform)
}
