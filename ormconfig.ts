import { DataSource } from 'typeorm';
import { join } from 'path';

const AppDataSource = new DataSource({
  type: 'sqlite',
  database: join(__dirname, 'database.sqlite'), // Define the path to your SQLite file
  entities: [join(__dirname, 'src/entity/**/*.ts')], // Define where your entities are located
  synchronize: true, // Auto-sync the schema (disable in production)
  logging: false,     // Enable logging of database queries (optional)
});

export default AppDataSource;
