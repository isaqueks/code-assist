import AppDataSource from "../../ormconfig";
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Project {

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column()
  path: string;

  @Column({ nullable: true })
  threadId: string;


  static get repo() {
    return AppDataSource.getRepository<Project>(Project);
  }

}