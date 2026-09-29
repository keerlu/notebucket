const { postDescription } = require('../../lib/description.js');

module.exports = {
  layout: 'layouts/post.njk',
  permalink: '/notebucket/{{ slug }}/',
  eleventyComputed: {
    // Used for <meta name="description"> and Atom <summary>.
    description: (data) => postDescription(data),
  },
};
