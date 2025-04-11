import { Schema, model } from "mongoose";

const menuCompetitorSchema = new Schema({
  name: { type: String, required: true },
  imageId: { type: String, required: true },
  price: { type: Number, required: true },
  ratings: {
    rating: { type: String, required: true },
    ratingCount: { type: String, required: true },
    ratingCountV2: { type: String, required: true }
  }
});

export default model('MenuCompetitor', menuCompetitorSchema);