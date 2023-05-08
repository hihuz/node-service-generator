import { ApplicationError } from "../../../common/errors/application-error.class";
import { AuthContextMetadata } from "../../../common/context/auth-context-metadata.class";
import { ClientError } from "../../../common/errors/client-error.config";
import Country from "../../models/country";
import { PermissionsManager } from "../../../common/generator/permissions-manager";
import { PermissionDefinition } from "../../../common/generator/permissions-manager";
import { Roles } from "../../constants/permissions";

export class CountryPermissionsManager extends PermissionsManager<Country> {
  protected model = Country;
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
