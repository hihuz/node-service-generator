# Node service generator

## Introduction

The files in this directory provide a system of base classes used to bootstrap a node micro-service directly interacting with our main database.

### Historical details

Historically our services needing data from that database were not directly connected to it, but rather were making requests to the main API to retrieve the data, acting as a kind of proxy to this main API.

By leveraging these base classes, we will be able to easily setup new endpoints and new services, connect them to the db and implement the necessary business logic on top.

## Database connection

The first step to setup a new service is to initialize the sequelize database connection.

This should be done in the root file of your service (`src/index.ts`) like so:

```typescript
SequelizeConnection.initialize({
    models: [Info, Status, SupplyNetwork],
});
```

The list of models will be later supplemented with the models necessary for your business logic (see: [models and associations](#models-and-associations)).

### Environment variables

In order to connect to the database you will need to provide several mandatory environment variables, namely:

-   DB_HOST: the hostname, e.g. 'db'
-   DB_SCHEMA: the database to connect to, e.g. 'public'
-   DB_USER
-   DB_PASSWORD

Additionally, some optional variables can be provided:

-   DB_PORT: the port to connect to the database, defaults to 3306
-   DB_POOL_MAX: the maximum number of connections in the pool, defaults to 5
-   DB_LOGGING: used to enable database logging with `DB_LOGGING=true`, mainly used for debugging purposes.

### Additional initialization options

When initializing the database connection, you can also customize it by passing other valid [sequelize constructor options](https://sequelize.org/master/class/lib/sequelize.js~Sequelize.html#instance-constructor-constructor).

Notably you can provide additional model paths, or customize the database logger to your liking.

## General architecture overview

![Architecture overview](https://raw.githubusercontent.com/hihuz/node-service-generator/main/src/common/generator/assets/generated_service_anonymized.png)

### data-provider

The data-provider is the main class and entry point to this system.

It has the responsibility to interact with the crud-controller by receiving requests, handling them by orchestrating the various other more focused classes, and returning the responses.

It implements the following interface:

```typescript
    | IGetListDataProvider<T>
    | IGetItemDataProvider<T>
    | ICreateItemDataProvider<T>
    | IUpdateItemDataProvider<T>
    | IDeleteItemDataProvider<T>
```

When creating a new endpoint for a service, you will typically extend the base SequelizeDataProvider, and in the constructor provide for your entity:

-   An order generator (see: [order-generator](#order-generator))
-   A filters generator (see: [filters-generator](#filters-generator))
-   A permissions manager (see: [permissions-manager](#permissions-manager))
-   A sequelize repository (see: [sequelize-repository](#sequelize-repository))
-   A serializer (see: [serializer](#serializer))
-   An input validator (see: [validator](#validator))

Example:

```typescript
export class MyEntityDataProvider extends SequelizeDataProvider<MyEntity, MyEntityInputDto, MyEntityResponseDto> {
    constructor() {
        const permissionsManager = new MyEntityPermissionsManager();
        const filtersGenerator = new MyEntityFiltersGenerator();
        const orderGenerator = new MyEntityOrderGenerator();

        super(
            new MyEntityRepository(permissionsManager, filtersGenerator, orderGenerator),
            new MyEntitySerializer(),
            new MyEntityInputValidator(),
            permissionsManager,
        );
    }
}
```

### order-generator

The order-generator's purpose is to generate a sequelize 'order' condition (i.e. an ORDER BY clause) from the 'sort_by' query parameters of a GET request.

Essentially this will order the results of a given `getList` request as specified by the user.

It directly interacts with the sequelize repository for a given entity.

It can handle ordering by fields of the base entity, but also by fields of nested relationships, which is why it is important to properly define your sequelize [models and associations](#models-and-associations).

Typically you will not need to implement any custom code for it to work for the general use cases.

An order-generator for a given entity would be created like so:

```typescript
export class MyEntityOrderGenerator extends OrderGenerator<MyEntity> {
    model = MyEntity;
    pathMap = myPathMap;
}
```

_Note:_ see [here](#pathMap-for-filters-and-order-generators) for details about the `pathMap` property.

#### order-generator Example

Let's consider we are creating a 'product' API, and we have the following entities:

-   a 'Product' entity with a 'name' property, and it has many 'Contact'.
-   a 'Contact' entity, with a 'name' property, and it has many 'Product', many 'Address' and one 'Info'.
-   an 'Info' entity with an 'id' property, and it has one 'Contact'

And the following 'product' API data structure exposed to users:

`{ name: 'product name', contacts: [{ name: 'contact name', info: { id: 1 } }] }`

The base order generator logic will handle such query parameters directly:

-   `?sort_by=name` (base field on 'Product')
-   `?sort_by=contact.name` (base field on the 'Contact' direct relationship)
-   `?sort_by=contact.info.id` (base field on a nested relationship, which can be inferred from the model definitions)
-   any combination of the above, e.g. `?sort_by=contact.name, -contact.info.id, name`

### filters-generator

The filters-generator's purpose is to generate a series of 'where' conditions from the multiple 'filter=' query parameters of a GET request.

Essentially this will filter the results of a given `getList` request to the entries matching the constraints specified by the user.

It directly interacts with the sequelize repository for a given entity.

It can handle filtering by fields of the base entity, but also by fields of nested relationships, which is why it is important to properly define your sequelize [models and associations](#models-and-associations).

Additionally, it can handle the various usual api filters operators: `"eq" | "like" | "gt" | "gte" | "lt" | "lte" | "ne" | "in" | "is"`.

A filters-generator for a given entity would be created like so:

```typescript
export class MyEntityFiltersGenerator extends FiltersGenerator<MyEntity> {
    model = MyEntity;
    pathMap = myPathMap;
}
```

_Note:_ see [here](#pathMap-for-filters-and-order-generators) for details about the `pathMap` property.

#### filters-generator Example

Let's consider the same 'product' API, and the same entities and relations as in the previous [order-generator Example](#order-generator-example).

The base filters generator logic will handle such query parameters directly:

-   `?filter=name ct joh` (base field on 'Product')
-   `?filter=contact.name is null` (base field on the 'Contact' direct relationship)
-   `?filter=contact.info.id in 1,23` (base field on a nested relationship, which can be inferred from the model definitions)
-   any combination of the above, e.g. `?filter=name ct joh&filter=contact.name is null&filter=contact.info.id in 1,23`

### pathMap for filters and order generators

Let's consider we are creating a 'product' API, and we have the following entities:

-   a 'Product' entity with a 'name' property, and it has many 'Contact'.
-   a 'Contact' entity, with a 'name' property, and it has many 'Product', many 'Address' and one 'Info'.
-   an 'Address' entity with an 'email' property, and it has many 'Contact'.
-   an 'Info' entity with an 'id' property, and it has one 'Contact'.

And the following 'product' API data structure exposed to users:

`{ name: 'product name', contacts: [{ name: 'contact name', email: 'contact@email.com, info: { id: 1 } }] }`

Note that users are not aware of the 'Address' entity (as it is only exposed as part of a contact), it is an implementation detail of our database structure.

Users might want to order or filter by email with such query parameters: `?sort_by=contact.email`, or `?filter=contact.email ct .de`

In order to handle such cases, the order-generator and filters-generator have a `pathMap` static property which can convert API query parameters to sequelize 'association chains' when the chain cannot be constructed automatically.

In our example, the pathMap would be defined like so: `{ "contact.email": "contact.address.email" }`.

### permissions-manager

The permissions-manager's purpose is twofold:

1. restrict and allow access to CRUD endpoints based on the provided list of permissions definitions.
2. generate where conditions filter the results of GET requests to the allowed entities, based on the provided list of permissions.

It directly interacts with the data-provider for the access to CRUD endpoints, and with the sequelize repository for restricting access to allowed entities.

Permissions definitions are objects comprised of:

-   A `key` representing a field in user tokens metadata.
-   Optionally, a `shouldApply` function determining if this definition should apply to the current user, based on its token metadata.

Permissions definitions will default to: `[{ key: "market_place" }]` which means that:

-   Since `shouldApply` is not defined for this definition, it will by default apply to everyone.
-   It will extract values for 'market_place' in the user's token metadata
-   For DELETE and UPDATE operations, it will retrieve the market_place id directly linked to the base entity and compare it with the values extracted from the token.
-   For CREATE operations, it will retrieve the `market_place.id` included in the input and compare it with the values extracted from the token.
-   For READ operations, it will generate a condition limiting the results to base entities linked to market_places with ids extracted from the token.

If additional or different definitions are provided, they will behave in a similar way for the defined keys, and skip verifications with `shouldApply` is defined and returns false.

A permissions-manager for a given entity would be created like so:

```typescript
export class MyEntityPermissionsManager extends PermissionsManager<MyEntity> {
    model = MyEntity;
    definitions = permissionsDefinitions;
    pathMap = myPathMap;
}
```

### pathMap for permissions-manager

Similarly to query parameters for filters and order generators, some permissions keys cannot be directly or automatically matched to a field or a relation for our base entity.

For solving such cases, the permissions-manager also has a `pathMap` property.

Let's consider we are creating an 'order' API, and we have the following entities:

-   an 'Order' entity which belongs to 'Product'.
-   a 'Product' entity which has many 'Order', and belongs to 'MarketPlace'.
-   a 'MarketPlace' entity, with an 'id' property, and it has many 'Product'.

And the following permission definition: `[{ key: 'market_place' }]`.

Note that our base entity 'Order' is not directly tied to a market_place, but only to a 'Product' which itself is tied to a market_place.

In order to properly look for the correct market_place and restrict access, we must specify such a path map: `{ 'market_place': 'product.market_place.id' }`.

### sequelize-repository

The sequelize-repository is the class performing the actual CRUD operations by communicating with the database.

When creating a new repository instance, it should be passed:

-   An order generator (see: [order-generator](#order-generator))
-   A filters generator (see: [filters-generator](#filters-generator))
-   A permissions manager (see: [permissions-manager](#permissions-manager))

For READ operations, it will merge conditions generated by the order-generator, the filters-generator and the permissions-manager in order to build a final condition to apply to the database queries.

For CREATE and UPDATE operations, it will infer the various entities to create and update based on the received input, this is why properly deserializing API input with the [deserializer](#deserializer) is important.

Additionally, it will:

-   Manage the soft-delete mechanism for entities with a status_id.
-   Manage the info entry for entities with an info_id.

### serializer

The serializer serves two purposes:

-   Deserialize API input to sequelize upsert attributes with the `deserialize` method.
-   Serializing a sequelize model instance to an API response with the `serialize`  method.

The data structure returned by `deserialize` must respect a certain number of sequelize conventions so that the various entity attributes as well as its nested relations attributes are handled properly:

-   All attributes present on the base entity model should be properly mapped, e.g. if the entity has a supply_network_id field for market places and the API input has a `{ market_place: { id: number } }` structure, `deserialize` should include: `supply_network_id: entity.market_place?.id`.
-   HasOne relationships (i.e. where the foreign key is on the relation model) should be specified as an object on the key of the relationship name.
-   HasMany (1:M) relationships should be specified as an array on the key of the relationship name.
-   BelongsToMany (M:N) relationships should be specified as an array on the key of the relationship name. It's also possible to specify them on the key of the relationship with the join table, but this will usually require defining additional associations in your model and more nested return values from `deserialize`.

Additionally, `deserialize` must be able to handle partial payloads, as it will be used for POST, PUT and PATCH endpoints.

#### deserialize example

Let's consider we are creating a 'product' API, and we have the following entities:

-   a 'Product' entity with a 'name' and a 'supply_network_id' property.
-   a 'SupplyNetwork' entity.
-   a 'Contact' entity, with a 'name' property.
-   an 'Address' entity, with an 'email' property.
-   a 'ProductTag' entity.
-   'Product' belongs to 'SupplyNetwork', the FK for this relationship is 'supply_network_id' on 'Product'.
-   'Product' has many 'ProductTag', 'ProductTag' has many 'Product' (M:N).
-   'Product' has many 'Contact', 'Contact' has many 'Product' (M:N).
-   'Contact' belongs to 'Address', the FK for this relationship is 'address_id' on 'Contact'.

We also have the following constraints:

-   When creating / updating a Product, we also want to create a corresponding Contact, and an Address corresponding to the Contact.
-   When creating / updating a Product, we do not want to create a SupplyNetwork, nor new ProductTags, instead we want to link the Product with already existing entries of these types of entities.

We defined the relations between entities like so:

-   'Product' belongs to 'SupplyNetwork' as 'market_place'
-   'Product' belongs to many 'ProductTag' as 'tags' (with product_product_tag as join table)
-   'Product' belongs to many 'Contact' as 'contacts' (with product_contact as join table)
-   'Contact' belongs to 'Address' as 'address'

The API input is provided with such structure:

```typescript
{
  name: 'Product name',
  market_place: {
    id: 1
  },
  tags: [{ id: 1 }, { id: 2 }],
  contacts: [{ name: 'John', email: 'john@email.com' }, { name: 'Jane', email: 'jane@email.com' }]
}
```

In this specific case, `deserialize` should be implemented in such a way:

```typescript
public async deserialize(product: Partial<IProduct>): Promise<Partial<ICreateProductAttributes>> {
    return {
        name: product.name,
        supply_network_id: product.market_place?.id,
        // Primary key 'id' for 'Contact' or 'Address' is not specified in the input, our logic
        // will infer it should first create an Address entry, then a Contact entry, and finally
        // a 'product_contact' entry
        contacts: product.contacts?.map((contact) => ({
          name: contact.name,
          address: {
              email: product.contact.email,
          }
        })),
        // Primary key 'id' for 'ProductTag' is specified in the input, our logic
        // will infer it shouldn't create new 'ProductTag' entries, but only entries
        // for the join table 'product_product_tag' of the relation.
        tags: product.tags?.map(({ id }) => ({ id })),
    };
}
```

### validator

The validator is the class performing input validation that cannot be performed directly by the swagger spec. Most notably this should be used for business logic validation requirements.

It interacts with the data-provider which calls the different validation methods before attempting to perform write operations.

It features three distinct validation tasks:

-   validateRelations: this method will validate that the entities provided with an "id" in inputs exist and are active (status_id = 1). It is called for CREATE and UPDATE operations.
-   validateImmutableFields: this method is called only for UPDATE operations, and will validate that all fields provided as `immutablePaths` static property remain the same in the input as in the record that is being updated.
-   validateInput: this method is called for CREATE and UPDATE operations, and does not perform anything by default. It is there to be overridden so that arbitrary validation rules can be implemented.

An validator for a given entity would be created like so:

```typescript
export class MyEntityInputValidator extends InputValidator<MyEntity, MyEntityInputDto> {
    model = MyEntity;
    immutablePaths = ["market_place.id", ...];

    public async validateInput(entity: MyEntityInputDto): Promise<void> {
      // Implement custom validation logic here
    }
}
```

## Models and Associations

Sequelize model definitions and their respective associations are heavily used to drive the logic of these new services.

It is therefore very important to define them thoroughly.

Models are TypeScript classes that generally represent a table in the database. They will have a number of attributes, most of which will represent a database column, and they will have a number of associations, which represent a relationship with other models (i.e. other tables).

### Table

The first step to define a new model is to create a class extending the base sequelize Model.

Alternatively, if your table has a status_id and hence a relationship with our Status model, you should extend our EntityModel (`src/common/models/entity.model.ts`) instead, as it already defines this relationship.

```typescript
import { Table } from "sequelize-typescript";
import EntityModel from "../../src/common/models/entity.model";

@Table
export class Product extends EntityModel {}
```

### Columns

The second step is to define properties on your model corresponding to the various database columns.

```typescript
import { Table, Column } from "sequelize-typescript";

@Table
export class Product extends EntityModel {
    @Column({ primaryKey: true, autoIncrement: true })
    id!: number;

    @Column
    name!: string;
}
```

The most usual data types can be inferred directly from the property type, but in some cases you will want to specify it as it will perform some additional validation before hitting the database. For example you might want to limit the length of string to a set number of characters.

```typescript
import { Table, Column, DataType } from "sequelize-typescript";
...

@Table
export class Product extends EntityModel {
    @Column({ primaryKey: true, autoIncrement: true })
    id!: number;

    @Column
    name!: string;

    @Column(DataType.STRING(3))
    currency_code!: string;
}
```

It is also important to indicate if a field is not nullable, in particular for foreign keys, as the information will be used when upserting relationships to decide if we should just attempt to nullify the foreign key field, or rather delete the related entity.

```typescript
import { Table, Column, DataType, AllowNull } from "sequelize-typescript";
...

@Table
export class Product extends EntityModel {
    @Column({ primaryKey: true, autoIncrement: true })
    id!: number;

    @AllowNull(false)
    @Column
    name!: string;

    @AllowNull(false)
    @Column(DataType.STRING(3))
    currency_code!: string;

    @AllowNull(false)
    @Column
    supply_network_id!: number;
}
```

### Associations

Once the columns are defined, it is time to define the various associations of our entity.

The different types of associations as defined by sequelize are:

-   BelongsTo: this is a 1:1 relationship where the foreign key is on our entity.
-   HasOne: this is a 1:1 relationship where the foreign key is on the target model (the relation).
-   HasMany: this is a 1:M relationship where typically the target model will have a foreign key to our entity.
-   BelongsToMany: this is a M:N relationship where an additional table (the join table, or 'through' table in sequelize terms) is necessary to link several of our base entities with several entities of the related type.

Let's detail BelongsTo and BelongsToMany associations, as they are the most common in our database.

#### BelongsTo

BelongsTo is the most common type of association. In our case, we can see that our model has a supply_network_id column, which would indicate that it has a BelongsTo relation with the SupplyNetwork model.

In such a case, we should:

-   Add a ForeignKey decorator on the foreign key column
-   Add a field on our class representing the relation

```typescript
import { Table, Column, DataType, AllowNull, ForeignKey, BelongsTo } from "sequelize-typescript";
import SupplyNetwork from "models/supply_network";
...

@Table
export class Product extends EntityModel {
    @Column({ primaryKey: true, autoIncrement: true })
    id!: number;

    @AllowNull(false)
    @Column
    name!: string;

    @AllowNull(false)
    @Column(DataType.STRING(3))
    currency_code!: string;

    @AllowNull(false)
    @ForeignKey(() => SupplyNetwork)
    @Column
    supply_network_id!: number;

    @BelongsTo(() => SupplyNetwork)
    supply_network!: SupplyNetwork;
}
```

#### BelongsToMany

BelongsToMany is also a frequently used association.

Let's consider that our Product entity can have several contacts. Contacts however are not specific to products, a contact is generic and can belong to one or several other types of entities. Additionally, a contact might be related not to a single Product, but to several of them.

This is a BelongsToMany relationship, and we will have in our database an additional table (the join table) linking an entry in each table with their respective id.

To setup such a relationship, we will first need to define the model for the join table ProductContact:

```typescript
import { Table, Column, AllowNull, ForeignKey, Model } from "sequelize-typescript";
import Contact from "models/contact";
import Product from "models/product";

@Table
// Join table typically do not have status_ids, so they will extend the base Model
export class ProductContact extends Model {
    @AllowNull(false)
    @ForeignKey(() => Contact)
    @Column
    contact_id!: number;

    @AllowNull(false)
    @ForeignKey(() => Product)
    @Column
    product_id!: number;
}
```

Then in our entity model, we need to define the association:

```typescript
import { Table, Column, DataType, AllowNull, ForeignKey, BelongsTo, BelongsToMany } from "sequelize-typescript";
import Contact from 'models/contact';
import ProductContact from 'models/product_contact';
...

@Table
export class Product extends EntityModel {
    @Column({ primaryKey: true, autoIncrement: true })
    id!: number;

    @AllowNull(false)
    @Column
    name!: string;

    @AllowNull(false)
    @Column(DataType.STRING(3))
    currency_code!: string;

    @AllowNull(false)
    @ForeignKey(() => SupplyNetwork)
    @Column
    supply_network_id!: number;

    @BelongsTo(() => SupplyNetwork)
    supply_network!: SupplyNetwork;

    @BelongsToMany(() => Contact, () => ProductContact)
    contacts: Contact[];
}
```

### Adding models to the sequelize instance

Once your models are defined, you need to register them to your sequelize instance.

To do so the easiest way is to have a separate file per model, default export your models in all files, and put all model files in the same directory (usually `src/models`).

Then when initializing the sequelize connection, you should register your models like so:

```typescript
SequelizeConnection.initialize({
    // Common models imported from common/models
    models: [Info, Status, SupplyNetwork],
    // Your own models directory
    modelPaths: [__dirname + "/models"],
});
```

### Aliases

Sometimes the name of an entity or a column in our database does not match what is exposed to users of our APIs.

In such cases the best practice is to rely on aliases: the database entity name or column name will become an implementation detail, and sequelize as well as our code will refer to them as their user-facing name.

For example, supply networks are stored in our database table 'supply_network' but are almost always known to users as market places (i.e. 'market_place').

Additionally, let's consider that the database column for 'currency_code' is actually named 'currency_alphabetic_code', but this concept is only known to users as 'currency_code'.

We should update our model in this fashion:

```typescript
@Table
export class Product extends EntityModel {
    @Column({ primaryKey: true, autoIncrement: true })
    id!: number;

    @AllowNull(false)
    @Column
    name!: string;

    @AllowNull(false)
    // The @Column argument is changed to an option object with a 'field' property defining the database name of this column
    @Column({ type: DataType.STRING(3), field: "currency_alphabetic_code" })
    currency_code!: string;

    @AllowNull(false)
    @ForeignKey(() => SupplyNetwork)
    @Column
    supply_network_id!: number;

    @BelongsTo(() => SupplyNetwork)
    // The association name is changed from 'supply_network' to 'market_place'
    market_place!: SupplyNetwork;

    @BelongsToMany(() => Contact, () => ProductContact)
    contacts: Contact[];
}
```

After these changes, we will no longer refer to 'supply_network' in terms of product associations, and we will no longer refer to 'currency_alphabetic_code'.

### Attributes

Several methods on sequelize models (for example `.get()` which returns a model's attributes) can be typed more strictly by specifying arguments to the Model / EntityModel base class.

We provide a `ModelAttributes` type to help with these type definitions.

```typescript
import { ModelAttributes } from "types/model-attributes";

type ProductAttributes = ModelAttributes<Product>;

type CreateProductAttributes = Pick<ProductAttributes, ...>;

@Table
export class Product extends EntityModel<ProductAttributes, CreateProductAttributes> implements ProductAttributes {
    ...
}
```

With these definitions, `Product.get()` will return an object of `ProductAttributes` instead of `any` , and `Product.create({ ... })` will expect an object of type `CreateProductAttributes`.
