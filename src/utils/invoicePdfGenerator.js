const PDFDocument = require('pdfkit');

/**
 * Generates a professional PDF invoice and pipes it to the output stream.
 * 
 * @param {Object} order - The order database record
 * @param {Array<Object>} items - Array of order items
 * @param {stream.Writable} outputStream - The output stream to pipe the PDF to (e.g. res)
 */
function generateInvoicePdf(order, items, outputStream) {
  const doc = new PDFDocument({ margin: 50 });
  
  // Pipe PDF stream to destination
  doc.pipe(outputStream);
  
  // Title / Logo Area
  doc.fontSize(22).font('Helvetica-Bold').fillColor('#2d3748').text('INVOICE', { align: 'right' });
  
  // Horizontal line divider
  doc.moveTo(50, 80).lineTo(560, 80).strokeColor('#e2e8f0').lineWidth(1.5).stroke();
  
  // Sender info (Merchant Details)
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#4a5568').text('MVP Shopify Store', 50, 95);
  doc.font('Helvetica').fillColor('#718096');
  doc.text('E-Commerce Solutions Inc.', 50, 110);
  doc.text('Jakarta, Indonesia', 50, 122);
  doc.text('support@mvpshopify.com', 50, 134);
  
  // Invoice Metadata (Order details)
  doc.font('Helvetica-Bold').fillColor('#4a5568').text('Order Information:', 350, 95);
  doc.font('Helvetica').fillColor('#718096');
  doc.text(`Order UUID: ${order.order_uuid}`, 350, 110);
  doc.text(`Placed Date: ${order.created_at}`, 350, 122);
  doc.text(`Status: ${order.status}`, 350, 134);
  
  // Bill & Shipping Details
  doc.font('Helvetica-Bold').fillColor('#2d3748').fontSize(11).text('Bill To & Shipping Address:', 50, 165);
  doc.moveTo(50, 180).lineTo(560, 180).strokeColor('#edf2f7').lineWidth(1).stroke();
  
  doc.font('Helvetica').fillColor('#4a5568').fontSize(10);
  doc.text(`Customer Name: ${order.customer_name}`, 50, 190);
  doc.text(`Email Address: ${order.customer_email}`, 50, 202);
  doc.text(`Phone Number: ${order.customer_phone}`, 50, 214);
  doc.text(`Shipping Address:\n${order.customer_address}`, 50, 226, { width: 510, lineGap: 2 });
  
  // Table Title
  doc.font('Helvetica-Bold').fillColor('#2d3748').fontSize(11).text('Line Items', 50, 290);
  doc.moveTo(50, 305).lineTo(560, 305).strokeColor('#cbd5e0').lineWidth(1.5).stroke();
  
  // Table Header
  let y = 315;
  doc.font('Helvetica-Bold').fillColor('#4a5568').fontSize(9);
  doc.text('Item Description', 50, y);
  doc.text('SKU', 250, y);
  doc.text('Price', 350, y, { width: 70, align: 'right' });
  doc.text('Qty', 440, y, { width: 30, align: 'center' });
  doc.text('Subtotal', 490, y, { width: 70, align: 'right' });
  
  doc.moveTo(50, y + 15).lineTo(560, y + 15).strokeColor('#e2e8f0').lineWidth(1).stroke();
  
  // Render Items
  y += 25;
  doc.font('Helvetica').fillColor('#2d3748').fontSize(9);
  
  items.forEach((item, index) => {
    // Check page boundaries
    if (y > 700) {
      doc.addPage();
      y = 50;
      
      // Reprint header on new page
      doc.font('Helvetica-Bold').fillColor('#4a5568').fontSize(9);
      doc.text('Item Description', 50, y);
      doc.text('SKU', 250, y);
      doc.text('Price', 350, y, { width: 70, align: 'right' });
      doc.text('Qty', 440, y, { width: 30, align: 'center' });
      doc.text('Subtotal', 490, y, { width: 70, align: 'right' });
      doc.moveTo(50, y + 15).lineTo(560, y + 15).strokeColor('#cbd5e0').lineWidth(1).stroke();
      y += 25;
      doc.font('Helvetica').fillColor('#2d3748').fontSize(9);
    }
    
    const priceVal = Number(item.price);
    const subtotal = priceVal * item.quantity;
    const formattedPrice = `IDR ${priceVal.toLocaleString('id-ID')}`;
    const formattedSubtotal = `IDR ${subtotal.toLocaleString('id-ID')}`;
    
    doc.text(item.item_name, 50, y, { width: 190 });
    doc.text(item.sku || 'N/A', 250, y, { width: 90 });
    doc.text(formattedPrice, 350, y, { width: 70, align: 'right' });
    doc.text(item.quantity.toString(), 440, y, { width: 30, align: 'center' });
    doc.text(formattedSubtotal, 490, y, { width: 70, align: 'right' });
    
    y += 20;
  });
  
  // Total block
  if (y > 680) {
    doc.addPage();
    y = 50;
  }
  
  doc.moveTo(50, y).lineTo(560, y).strokeColor('#cbd5e0').lineWidth(1.5).stroke();
  y += 12;
  
  doc.font('Helvetica-Bold').fillColor('#4a5568').fontSize(10);
  doc.text('Total Weight:', 320, y, { width: 100, align: 'right' });
  doc.font('Helvetica').text(`${Number(order.total_weight).toLocaleString('id-ID')} g`, 490, y, { width: 70, align: 'right' });
  
  y += 18;
  doc.font('Helvetica-Bold').fillColor('#2d3748').fontSize(11);
  doc.text('Grand Total:', 320, y, { width: 100, align: 'right' });
  doc.text(`IDR ${Number(order.total_price).toLocaleString('id-ID')}`, 450, y, { width: 110, align: 'right' });
  
  // Footer notice
  doc.fontSize(8).fillColor('#a0aec0').text('Thank you for shopping with MVP Shopify Store! Please keep this invoice copy for your records.', 50, 720, { align: 'center', width: 500 });
  
  doc.end();
}

module.exports = {
  generateInvoicePdf
};
