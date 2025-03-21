import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { prisma } from "./prisma.js";

const app = new Hono()
//Customers
app.get('/customers/top', async (c) => {
  const topCustomers = await prisma.customer.findMany({ 
    orderBy: { orders: { _count: 'desc' } }, 
    take: 5 
  });
  return c.json(topCustomers);
  
});
app.post('/customers', async (c) => {
  const { name, email, phoneNumber, address } = await c.req.json<{ name: string; email: string; phoneNumber: string; address: string }>();
  try {
      const customer = await prisma.customer.create({ data: { name, email, phoneNumber, address } });
      return c.json(customer);
  } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'An unknown error occurred' }, 400);
  }
});
app.get('/customers/:id', async (c) => {
  const customer = await prisma.customer.findUnique({
     where: { id: Number(c.req.param('id')) } 
    });
  return c.json(customer);
});

app.get('/customers/:id/orders', async (c) => {
  const orders = await prisma.order.findMany({ 
    where: { customerId: Number(c.req.param('id')) } });
  return c.json(orders);
});


// Restaurants
app.post('/restaurants', async (c) => {
  const { name, location } = await c.req.json<{ name: string; location: string }>();
  try {
      const restaurant = await prisma.restaurant.create({ data: { name, location } });
      return c.json(restaurant);
  } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'An unknown error occurred' }, 400);
  }
});
app.get('/restaurants/:id/menu', async (c) => {
  const menuItems = await prisma.menuItem.findMany({ 
    where: { restaurantId: Number(c.req.param('id')), 
      isAvailable: true } });
  return c.json(menuItems);
});

// Menu Items
app.post('/restaurants/:id/menu', async (c) => {
  const { name, price, isAvailable } = await c.req.json<{ name: string; price: number; isAvailable: boolean }>();
  try {
      const menuItem = await prisma.menuItem.create({ data: { name, price, isAvailable, restaurantId: Number(c.req.param('id')) } });
      return c.json(menuItem);
  } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : 'An unknown error occurred' }, 400);
  }
});
app.patch('/menu/:id', async (c) => {
  const { price, isAvailable } = await c.req.json<{ price: number; isAvailable: boolean }>();
  const updatedItem = await prisma.menuItem.update({ 
    where: { id: Number(c.req.param('id')) }, 
    data: { price, isAvailable } });
  return c.json(updatedItem);
});

// Orders
app.post('/orders', async (c) => {
  try {
      const { customerId, restaurantId, items } = await c.req.json();

      if (!Array.isArray(items) || items.length === 0) {
          return c.json({ error: "Invalid or empty order items array" }, 400);
      }

      const customer = await prisma.customer.findUnique({ where: { id: customerId } });
      if (!customer) return c.json({ error: "Customer not found" }, 404);

      const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
      if (!restaurant) return c.json({ error: "Restaurant not found" }, 404);

      let totalPrice = 0;
      for (const item of items) {
          const menuItem = await prisma.menuItem.findUnique({ where: { id: item.menuItemId } });
          if (!menuItem || !menuItem.isAvailable) {
              return c.json({ error: `Menu item with ID ${item.menuItemId} is unavailable` }, 404);
          }
          totalPrice += Number(menuItem.price) * item.quantity;
      }

      const order = await prisma.order.create({
          data: {
              customerId,
              restaurantId,
              totalPrice,
              orderItems: {
                  create: items.map((item) => ({
                      menuItemId: item.menuItemId,
                      quantity: item.quantity,
                  })),
              },
          },
          include: { orderItems: true },
      });

      return c.json(order, 201);
  } catch (error) {
      return c.json({ error: "Internal server error", details: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
app.get('/orders/:id', async (c) => {
  const order = await prisma.order.findUnique({ 
    where: { id: Number(c.req.param('id')) },
     include: { orderItems: true } });
  return c.json(order);
});
app.patch('/orders/:id/status', async (c) => {
  const { status } = await c.req.json<{ status: string }>();
  const updatedOrder = await prisma.order.update({ 
    where: { id: Number(c.req.param('id')) },
     data: { status } });
  return c.json(updatedOrder);
})
//Reports and insights 
app.get('/restaurants/:id/revenue', async (c) => {
  const orders = await prisma.order.findMany({ 
    where: { restaurantId: Number(c.req.param('id')) }
   });
  const revenue = orders.reduce((sum, order) => sum + Number(order.totalPrice), 0);
  return c.json({ revenue });
});
app.get('/menu/top-items', async (c) => {
  const topItems = await prisma.orderItem.groupBy({ 
    by: ['menuItemId'], 
    _sum: { quantity: true }, 
    orderBy: { _sum: { quantity: 'desc' } }, 
    take: 1
   });
  return c.json(topItems);
});


serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
