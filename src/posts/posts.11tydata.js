const { postDescription } = require('../../lib/description.js');

module.exports = {
  layout: 'layouts/post.njk',
  permalink: '/notebucket/{{ slug }}/',
  // Drives og:type in base.njk; everything else on the site is a "website".
  og_type: 'article',
  eleventyComputed: {
    // Used for <meta name="description"> and Atom <summary>.
    description: (data) => postDescription(data),
  },
};
