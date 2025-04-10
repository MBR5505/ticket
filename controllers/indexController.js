/**
 * Index Controller
 * Handles rendering of public pages
 */

/**
 * @desc    Show homepage
 * @route   GET /
 * @access  Public
 */
exports.getHomePage = (req, res) => {
  try {
    // Set up meta title
    const title = 'Helpdesk - Brukerstøtte System';
    
    // Check if user is authenticated
    const isAuthenticated = req.isAuthenticated && req.isAuthenticated();
    
    if (isAuthenticated) {
      // If authenticated, redirect to appropriate dashboard
      if (req.user.role === 'admin' || req.user.role === 'head_admin') {
        return res.redirect('/admin/dashboard');
      } else {
        return res.redirect('/user/dashboard');
      }
    }
    
    // Otherwise render the homepage
    res.render('index', {
      title,
      layout: 'main-layout',
      activePage: 'home'
    });
  } catch (error) {
    console.error('Error rendering homepage:', error);
    res.status(500).render('error', {
      message: 'Kunne ikke laste startsiden',
      error,
      status: 500
    });
  }
};

/**
 * @desc    Show contact page
 * @route   GET /contact
 * @access  Public
 */
exports.getContactPage = (req, res) => {
  try {
    const title = 'Kontakt Oss - Helpdesk';
    
    // Check if user is authenticated
    const isAuthenticated = req.isAuthenticated && req.isAuthenticated();
    
    if (isAuthenticated) {
      res.render('contact', {
        title,
        activePage: 'contact',
        user: req.user
      });
    } else {
      res.render('contact', {
        title,
        layout: 'main-layout',
        activePage: 'contact'
      });
    }
  } catch (error) {
    console.error('Error rendering contact page:', error);
    res.status(500).render('error', {
      message: 'Kunne ikke laste kontaktsiden',
      error,
      status: 500
    });
  }
};

/**
 * @desc    Handle contact form submission
 * @route   POST /contact
 * @access  Public
 */
exports.submitContactForm = (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    
    // Basic validation
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Vennligst fyll ut alle påkrevde felt'
      });
    }
    
    // Here you would typically save the contact submission to your database
    // and/or send an email notification
    
    // For now, just return success response
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      // AJAX request
      return res.status(200).json({
        success: true,
        message: 'Takk for din henvendelse. Vi vil kontakte deg snart.'
      });
    } else {
      // Regular form submission
      req.flash('success', 'Takk for din henvendelse. Vi vil kontakte deg snart.');
      return res.redirect('/contact');
    }
  } catch (error) {
    console.error('Error submitting contact form:', error);
    
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
      return res.status(500).json({
        success: false,
        message: 'Det oppstod en feil. Vennligst prøv igjen senere.'
      });
    } else {
      req.flash('error', 'Det oppstod en feil. Vennligst prøv igjen senere.');
      return res.redirect('/contact');
    }
  }
};

/**
 * @desc    Show error page
 * @route   GET /error
 * @access  Public
 */
exports.getErrorPage = (req, res) => {
  const status = req.query.status || 500;
  const message = req.query.message || 'En feil har oppstått';
  
  res.status(parseInt(status)).render('error', {
    title: 'Feil - Helpdesk',
    message,
    status,
    layout: 'main-layout'
  });
};

/**
 * @desc    Show terms page
 * @route   GET /terms
 * @access  Public
 */
exports.getTermsPage = (req, res) => {
  try {
    const title = 'Bruksvilkår - Helpdesk';
    
    // Check if user is authenticated
    const isAuthenticated = req.isAuthenticated && req.isAuthenticated();
    
    if (isAuthenticated) {
      res.render('terms', {
        title,
        activePage: 'terms',
        user: req.user
      });
    } else {
      res.render('terms', {
        title,
        layout: 'main-layout',
        activePage: 'terms'
      });
    }
  } catch (error) {
    console.error('Error rendering terms page:', error);
    res.status(500).render('error', {
      message: 'Kunne ikke laste bruksvilkårene',
      error,
      status: 500
    });
  }
};

/**
 * @desc    Show privacy policy page
 * @route   GET /privacy
 * @access  Public
 */
exports.getPrivacyPage = (req, res) => {
  try {
    const title = 'Personvern - Helpdesk';
    
    // Check if user is authenticated
    const isAuthenticated = req.isAuthenticated && req.isAuthenticated();
    
    if (isAuthenticated) {
      res.render('privacy', {
        title,
        activePage: 'privacy',
        user: req.user
      });
    } else {
      res.render('privacy', {
        title,
        layout: 'main-layout',
        activePage: 'privacy'
      });
    }
  } catch (error) {
    console.error('Error rendering privacy page:', error);
    res.status(500).render('error', {
      message: 'Kunne ikke laste personvernerklæringen',
      error,
      status: 500
    });
  }
};
