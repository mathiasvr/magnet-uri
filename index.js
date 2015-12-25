module.exports = magnetURIDecode
module.exports.decode = magnetURIDecode
module.exports.encode = magnetURIEncode

var base32 = require('thirty-two')
var extend = require('xtend')
var uniq = require('uniq')

var qs = require('querystring')
var filter = require('object-filter')

qs.escape = function (s) {
  console.log('escaping', s)
  return s.startsWith('urn:') ? s : encodeURIComponent(s).replace(/%20/g, '+')
}

/**
 * Parse a magnet URI and return an object of keys/values
 *
 * @param  {string} uri
 * @return {Object} parsed uri
 */
function magnetURIDecode (uri) {
  var result = {}
  var data = uri.split('magnet:?')[1]

  var params = (data && data.length >= 0)
    ? data.split('&')
    : []

  params.forEach(function (param) {
    var keyval = param.split('=')

    // This keyval is invalid, skip it
    if (keyval.length !== 2) return

    var key = keyval[0]
    var val = keyval[1]

    // Clean up torrent name
    if (key === 'dn') val = decodeURIComponent(val).replace(/\+/g, ' ')

    // Address tracker (tr), exact source (xs), and acceptable source (as) are encoded
    // URIs, so decode them
    if (key === 'tr' || key === 'xs' || key === 'as' || key === 'ws') {
      val = decodeURIComponent(val)
    }

    // Return keywords as an array
    if (key === 'kt') val = decodeURIComponent(val).split('+')

    // If there are repeated parameters, return an array of values
    if (result[key]) {
      if (Array.isArray(result[key])) {
        result[key].push(val)
      } else {
        var old = result[key]
        result[key] = [old, val]
      }
    } else {
      result[key] = val
    }
  })

  // Convenience properties for parity with `parse-torrent-file` module
  var m
  if (result.xt) {
    var xts = Array.isArray(result.xt) ? result.xt : [ result.xt ]
    xts.forEach(function (xt) {
      if ((m = xt.match(/^urn:btih:(.{40})/))) {
        result.infoHash = m[1].toLowerCase()
      } else if ((m = xt.match(/^urn:btih:(.{32})/))) {
        var decodedStr = base32.decode(m[1])
        result.infoHash = new Buffer(decodedStr, 'binary').toString('hex')
      }
    })
  }
  if (result.infoHash) result.infoHashBuffer = new Buffer(result.infoHash, 'hex')

  if (result.dn) result.name = result.dn
  if (result.kt) result.keywords = result.kt

  if (typeof result.tr === 'string') result.announce = [ result.tr ]
  else if (Array.isArray(result.tr)) result.announce = result.tr
  else result.announce = []

  uniq(result.announce)

  result.urlList = []
  if (typeof result.as === 'string' || Array.isArray(result.as)) {
    result.urlList = result.urlList.concat(result.as)
  }
  if (typeof result.ws === 'string' || Array.isArray(result.ws)) {
    result.urlList = result.urlList.concat(result.ws)
  }

  return result
}

function magnetURIEncode (obj) {
  obj = extend(obj) // clone obj, so we can mutate it

  // support using convenience names, in addition to spec names
  // (example: `infoHash` for `xt`, `name` for `dn`)
  if (obj.infoHashBuffer) obj.xt = 'urn:btih:' + obj.infoHashBuffer.toString('hex')
  if (obj.infoHash) obj.xt = 'urn:btih:' + obj.infoHash
  if (obj.name) obj.dn = obj.name
  if (obj.keywords) obj.kt = obj.keywords
  if (obj.announce) obj.tr = obj.announce
  if (obj.urlList) {
    obj.ws = obj.urlList
    delete obj.as
  }

  if (obj.kt) obj.kt = obj.kt.join(' ')

  return 'magnet:?' + qs.stringify(filter(obj, function (val, key) {
    return key.length === 2
  }))
}
