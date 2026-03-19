const checkPlan = (requiredPlan) => {
  return (req, res, next) => {
    if (req.user.plan !== requiredPlan) {
      return res.status(403).json({
        message: `Upgrade to ${requiredPlan} plan to access this feature`
      });
    }
    next();
  };
};

module.exports = checkPlan;