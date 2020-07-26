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

const params = {
  track: '#100DaysOfCode',
}

bot
  .stream('statuses/filter', params)
  .on('start', () => console.log('start'))
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
      case Boolean(tweet.quoted_status):
      case Boolean(tweet.in_reply_to_status_id_str):
      case Boolean(tweet.in_reply_to_user_id_str):
      case Boolean(tweet.possibly_sensitive):
      case Boolean(!tweet.entities.urls.length):
      case Boolean(!tweet.text.match(/^RT /g)):
        return
    }
    for (let url of tweet.entities.urls) {
      console.log('checking url', url.expanded_url)
      if (
        !url.expanded_url.match(
          /(github\.com|gitlab\.com|codepen\.io|codesandbox\.io|jsfiddle\.net|jsbin\.com|plnkr\.co|repl\.it|stackblitz\.com)/
        )
      ) {
        return
      }
    }
    tweet.entities = JSON.stringify(tweet.entities, undefined, 2)
    try {
      if (prod) {
        console.log('retweeting', tweet)
        await bot.post(`statuses/retweet/${tweet.id_str}`)
      } else {
        console.debug('debug', tweet)
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
  .on('ping', () => console.log('ping'))
  .on('error', (error) => console.log('error', error))
  .on('end', () => console.log('end'))
