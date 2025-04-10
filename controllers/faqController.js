/**
 * FAQ Controller
 * Handles rendering of the FAQ page
 */

/**
 * @desc    Show FAQ page
 * @route   GET /faq
 * @access  Public
 */
exports.getFaqPage = (req, res) => {
  try {
    // Set up meta title
    const title = 'Vanlige spørsmål - Helpdesk';
    
    // Check if user is authenticated
    const isAuthenticated = req.isAuthenticated && req.isAuthenticated();
    
    // Render the appropriate layout based on authentication status
    if (isAuthenticated) {
      res.render('faq', {
        title,
        activePage: 'faq',
        user: req.user
      });
    } else {
      res.render('faq', {
        title,
        layout: 'main-layout'
      });
    }
  } catch (error) {
    console.error('Error rendering FAQ page:', error);
    res.status(500).render('error', {
      message: 'Kunne ikke laste FAQ-siden',
      error,
      status: 500
    });
  }
};
