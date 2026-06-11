const { checkUrlFrameability } = require('./app/customer/[team_slug]/asset/actions.ts');

async function test() {
  try {
    const res = await checkUrlFrameability('https://nuexis.com');
    console.log('Result:', res);
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
