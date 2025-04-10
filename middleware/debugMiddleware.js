module.exports = (req, res, next) => {
  console.log('Request path:', req.path);
  console.log('Cookies present:', req.cookies ? Object.keys(req.cookies) : 'none');
  console.log('Session user:', req.session && req.session.user ? 'yes' : 'no');
  next();
};
