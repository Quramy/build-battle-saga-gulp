const fs = require('fs')
const path = require('path')
const { src, dest, parallel } = require('gulp')
const { File } = require('gulp-util')
const replace = require('gulp-replace')
const { prefix } = require('minimist')(process.argv.slice(2), {
  alias: { p: 'prefix' },
})

const through = require('through2')

const injectPreload = function({ template, outName, prefix = '' }) {
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

module.exports.injectPreview = () =>
  src('public/**/*.+(png|jpg|jpeg|svg)')
    .pipe(
      injectPreload({
        template: './.storybook/preview-head.template.html',
        outName: 'preview-head.html',
      }),
    )
    .pipe(dest('./.storybook'))

module.exports.replacePrefix = parallel(
  () =>
    src('src/**/*.+(jsx|html)')
      .pipe(
        replace(/(<img[^>]*\s+)src="([^"]*)"/g, (_, pre, url) =>
          /^https?/.test(url) ? _ : `${pre}src="${prefix}${url}"`,
        ),
      )
      .pipe(dest('dist')),
  () =>
    src('src/**/*.+(scss|css)')
      .pipe(
        replace(/(url\(')([^']*)/g, (_, pre, url) =>
          /^https?/.test(url) ? _ : `${pre}${prefix}${url}`,
        ),
      )
      .pipe(
        replace(/(url\(")([^"]*)/g, (_, pre, url) =>
          /^https?/.test(url) ? _ : `${pre}${prefix}${url}`,
        ),
      )
      .pipe(dest('dist')),
)
