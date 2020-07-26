/* global process */
const config = require('./config.json')
const Twitter = require('twitter-lite')

const bot = new Twitter({
  consumer_key: config.twitter.apiKey,
  consumer_secret: config.twitter.apiSecret,
  access_token_key: config.twitter.accessToken,
  access_token_secret: config.twitter.accessTokenSecret,
})

const env = process.env.NODE_ENV
const prod = env === 'production'
const mode = prod ? env : 'development'
console.log(`running in ${mode} mode`)

const debug = (...args) => {
  if (!prod) {
    console.debug(...args)
  }
}

const params = {
  track: '#100DaysOfCode',
}

bot
  .stream('statuses/filter', params)
  .on('start', () => console.log('starting filtered status stream'))
  .on('data', async (tweet) => {
    delete tweet.user
    // normalize when truncated
    if (tweet.truncated) {
      tweet.text = tweet.extended_tweet.full_text
      tweet.entities = tweet.extended_tweet.entities
      delete tweet.extended_tweet
    }
    switch (true) {
      case Boolean(tweet.retweeted_status):
        debug('filtered', 'retweeted status')
        return
      case Boolean(tweet.retweeted):
        debug('filtered', 'already retweeted')
        return
      case Boolean(tweet.quoted_status):
        debug('filtered', 'quoted status')
        return
      case Boolean(tweet.in_reply_to_status_id_str):
        debug('filtered', 'in reply to status')
        return
      case Boolean(tweet.in_reply_to_user_id_str):
        debug('filtered', 'in reply to user')
        return
      case Boolean(tweet.text.match(/^RT /g)):
        debug('filtered', 'tweet begins with RT')
        return
      case Boolean(tweet.possibly_sensitive):
        debug('filtered', 'possibly sensitive')
        return
      case Boolean(!tweet.entities.urls.length):
        debug('filtered', 'no urls')
        return
    }
    let urlMatch = false
    debug('checking urls')
    for (let url of tweet.entities.urls) {
      debug('  ', url.expanded_url)
      if (
        url.expanded_url.match(
          /(github\.com|gitlab\.com|codepen\.io|codesandbox\.io|jsfiddle\.net|jsbin\.com|plnkr\.co|repl\.it|stackblitz\.com)/
        )
      ) {
        debug('good url')
        urlMatch = true
        break
      }
    }
    if (!urlMatch) {
      debug('filtered', 'no matching urls')
      return
    }
    tweet.entities = JSON.stringify(tweet.entities, undefined, 2)
    try {
      if (prod) {
        console.log('retweeting', tweet)
        await bot.post(`statuses/retweet/${tweet.id_str}`)
      } else {
        debug('good tweet', tweet)
      }
    } catch (e) {
      console.error('error')
      console.error(e)
      if ('errors' in e) {
        if (e.errors[0].code === 88) {
          // rate limit exceeded
          console.log(
            'Rate limit will reset on',
            new Date(e._headers.get('x-rate-limit-reset') * 1000)
          )
        }
      }
    }
  })
  .on('ping', () => debug('ping received from stream'))
  .on('error', (error) => console.error('error received from sream', error))
  .on('end', () => console.log('stream ended'))
