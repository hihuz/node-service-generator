import { ApplicationError } from "../../../common/errors/application-error.class";
import { AuthContextMetadata } from "../../../common/context/auth-context-metadata.class";
import { ClientError } from "../../../common/errors/client-error.config";
import Currency from "../../models/currency";
import {
  PermissionDefinition,
  PermissionsManager,
} from "../../../common/generator/permissions-manager";
import { Roles } from "../../constants/permissions";

export class CurrencyPermissionsManager extends PermissionsManager<Currency> {
  protected model = Currency;
  protected definitions: PermissionDefinition[] = [];

  /**
   * @inheritDoc
   */
  public async validateReadPermissions(
    state: AuthContextMetadata
  ): Promise<void> {
    const isReader = state.hasValue(Roles.READER);

    if (!isReader) {
      throw new ApplicationError(ClientError.AUTH.FORBIDDEN.NO_PERMISSIONS);
    }
  }
}
