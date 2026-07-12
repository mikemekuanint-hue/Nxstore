// Mock Verify.et API service

const verifyPayment = async (reference) => {
  console.log(`Verifying payment reference: ${reference}`);
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  return { success: true, message: 'Payment verified' };
};

module.exports = {
  verifyPayment
};
