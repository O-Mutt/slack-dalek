import { Schema, Document, Model, Connection } from 'mongoose';
import { app } from '../../../app';

export interface IDalekConfig extends Document {
  slackToken?: string;
  daysSinceLastInteraction: number;
  dalekAdmins?: string[];
}

export const DalekConfigSchema = new Schema({
  slackToken: String,
  daysSinceLastInteraction: {
    type: Number,
    default: 30
  },
  dalekAdmins: [String],
});

DalekConfigSchema.statics.findOneOrCreate = async function (this: Model<DalekConfigInterface, DalekConfigModelInterface>, teamId: string): Promise<IDalekConfig> {
  const self = this;
  let dalekConfig = await self.findOne().exec();
  if (dalekConfig) {
    return dalekConfig;
  }

  const { members } = await app.client.users.list({ team_id: teamId });
  const admins = members?.filter((user) => user.is_admin === true);
  dalekConfig = new self({
    dalekAdmins: admins
  });
  return await self.create(dalekConfig);
};

export interface DalekConfigInterface extends IDalekConfig {
  // instance methods
}

export interface DalekConfigModelInterface extends Model<DalekConfigInterface> {
  // static methods
  findOneOrCreate(teamId: string): Promise<IDalekConfig>;
}

export const DalekConfig = (conn: Connection) =>
  conn.model<DalekConfigInterface, DalekConfigModelInterface>('dalekConfig', DalekConfigSchema);
