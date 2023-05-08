import MarketPlace from "../../models/market_place";
import { PermissionsManager } from "../../../common/generator/permissions-manager";
import { permissionsDefinitions } from "./config";

export class MarketPlacePermissionsManager extends PermissionsManager<MarketPlace> {
  protected model = MarketPlace;
  protected definitions = permissionsDefinitions;
  protected pathMap = {
    market_place: "id",
  };
}
