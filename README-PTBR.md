# **Featws Transpiler** [![About_en](https://github.com/yammadev/flag-icons/blob/master/png/US.png?raw=true)](https://github.com/bancodobrasil/featws-transpiler/blob/develop/README.md)




Uma ferramenta para transpilar os arquivos do FeatWS para [formato GRL](https://github.com/hyperjumptech/grule-rule-engine/blob/master/docs/en/GRL_en.md). 

## Software Requeridos
- node.js versão 10 ou superior.  
- node package manager (npm).
- Você pode obter um guia oficial para baixar estas ferramentas [aqui](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm).

## Inicializando o projeto
- Clone este repositório em sua máquina local.
- Abra seu terminal local no VScode e digite 'npm install' para instalar as dependências necessárias.
- Vá para a pasta `example` em seu terminal local e digite `npm start` para executar o projeto.


## Arquivos Requeridos

Existem três arquivos fundamentais para o correto funcionamento do transpiler:  

- features.json 
- parameters.json 
- rules.featws

Após executar o código, o transpiler buscará o conteúdo dentro destes três arquivos para gerar o arquivo de regras. Descreveremos cada um deles ao longo desta documentação.

### features.json

Este é o arquivo onde serão descritas as variáveis a serem calculadas. É necessário informar algumas definições sobre a característica como nome, tipo, quando expirará, se é padrão ou um fallback. A imagem abaixo mostra alguns exemplos de características.

<img src="Images/Features.png" width=25% height="auto">

É importante saber que o transpilador pode identificar uma feature diretamente do arquivo rules.featws, mas lembre-se de que seu tipo padrão é **boolean**. Se uma feature precisar de um tipo diferente, lembre-se de declará-lo no arquivo features.json.

#### Formato extendido


Existe outra maneira de descrever uma feature e está usando o formato estendido, como o exemplo abaixo.

 ```
		[age_4] 
		condition = #age2 > 4
		value = #age_2 + 2
		type =integer 
```

Você pode descrever a feature de maneira semelhante ao que é expresso nos arquivos features.json e parameter.json. Observe que você pode usar ou não uma condição para executar seu recurso. Neste caso, `age_4` só será processado se `#age_2` for maior que 4.


### parameters.json

Assim como o features.json, o arquivo parameters.json é responsável por declarar as variáveis. Nesse caso, todas as informações fornecidas como entrada precisam ser declaradas nesse arquivo.

<img src="Images/Parameters.png" width=25% height="auto">

## O que é o arquivo rules.featws?!

O arquivo rules.featws é essencial para a geração correta do arquivo rules.grl.

É necessário entender alguns pontos da sintaxe do arquivo para que o transpilador possa identificar as características e parâmetros nele inseridos.

### Marcadores Especiais
- O `#`identifica os recursos criados no arquivo features.json.

- O `$` identifica os parâmetros criados no arquivo parameters.json

- O `@` identifica um grupo.

### Expressões matemáticas

O arquivo rules.featws é onde você pode escrever as expressões lógicas e matemáticas. É o guia para o transpilador interpretar as linhas escritas e gerar o arquivo de regras

Você pode criar todos os tipos de expressões e cálculos, como mostra a imagem abaixo.

<img src="Images/FEATrulesfeatws.png" width=45% height="auto">

Sinta-se à vontade para usar operadores lógicos e matemáticos, variáveis ​​dependentes de outras variáveis ​​e grupos de acordo com suas necessidades.

## Construindo grupos

- Para construir grupos em ``featws-tranpiler`` você precisa primeiro estar em uma pasta com os arquivos: (Você pode copiar facilmente da pasta simple_group dentro da pasta example)

    - features.json
    - parameters.json
    - package.json
    - package-lock.json
    - rules.featws

- **Lembre-se de que esses arquivos mudarão na forma como você altera os objetivos**. Agora você tem que criar dentro desta pasta uma nova pasta chamada ``groups`` e dentro dela é o local que você colocará seus grupos. Aqui está um exemplo de um grupo simples:

    ```json
        {
            "{$branch}/{$account}": ["00000/00000000"]
        }
    ```

- Depois disso você precisa configurar seu arquivo ``parameters.json`` definindo os parâmetros que devem ser usados ​​no grupo anterior:

    ~~~json
    [
        {
            "name": "branch",  
            "type": "integer"  
        },
        {
            "name": "account",
            "type": "integer" 
        }
    ]
    ~~~

- Agora você pode dar um "apelido" para o grupo ``mygroup``, e este nome será definido no arquivo ``features.json``, desta forma:

    ```json
        [
            {
                "name": "clientingroup", 
                "type": "boolean",                
                "default": false,         
                "fallback": false
            }
        ]
    ```

- O último passo é definir uma regra para atingir seu objetivo e fazemos isso no arquivo ``rules.featws``, desta forma:

    ```
        clientingroup = @mygroup # setting our feature name to our group 
        
        # this action is too much simple, but already shows how to work 
        # with groups
    ```

- Para finalizar o projeto basta executar no seu terminal local o comando:
    ~~~shell
        # este comando irá gerar o arquivo .grl que será interpretado
        # pelo nosso projeto "featws-ruller"

        npx featws-transpiler
   ~~~

## Parâmetro obrigatório
- Agora podemos definir os parâmetros necessários no arquivo `parameters.json`, como:
```json
[
    {
        "name": "userName",
        "type": "string",
        "required": true
    }
]
```
- Usando esta instrução - o parâmetro "userName" é necessário e, se não tiver sido passado para o featws-ruller para avaliar a folha de regras, ocorrerá um erro.

## Carregado Remotamente (Remote Loaded)
- Um parâmetro carregado remotamente significa que os dados do parâmetro serão enviados via um resolver externo, que deve ser declarado no "parameters.json", desta forma:
```json
[
    {
        "name": "locale",
        "type": "string",
        "required": true
    },
    {
        "name": "clima",
        "type": "object",
        "resolver": "climatempo",
        "from": "weather"
    }
]
```
- Neste exemplo, estamos verificando o clima em algum local
- O "locale" é o que o resolver espera como parâmetro de solicitação.
- O outro é a declaração do próprio resolver:
    - `"name"` significa o apelido para o nome real do parâmetro de resposta do resolver.
    - `"type"` o tipo de parâmetro de resposta.
    - `"resolver"` o nome do resolver que você deseja acessar.
    - `"from"` nome original do parâmetro de resposta do resolverd.
### Apelido ou Pseudonimo
- Como visto acima você pode facilmente alterar o nome do parâmetro de resposta do resolver, mas não é uma obrigação, por exemplo:
```json
[
    {
        "name": "locale",
        "type": "string",
        "required": true
    },
    {
        "name": "weather",
        "type": "object",
        "resolver": "climatempo"
    }
]
```
- Uma pequena mudança, mas funcionará da mesma maneira que a opção com o apelido.



## Casos de Teste

Em algum momento, pode ser necessário testar novos casos para gerar regras. Para fazer isso, vá para o diretório `__tests__/cases` e crie uma nova pasta de teste.
Dentro dele, crie os arquivos parameters.json, features.json e rules.featws. Se você precisar de um grupo, crie uma nova pasta `groups` como nas etapas descritas acima. Após o preenchimento de todos os arquivos essenciais, recomendamos criar manualmente o arquivo `expected.grl` para compará-lo com o arquivo de regras gerado pelo transpilador.

### O arquivo expected.grl
Usamos esse arquivo para garantir que o transpilador gerou o rules.grl corretamente. O arquivo de regras tem sua própria sintaxe, conforme demonstramos abaixo.

<img src="Images/expected.png" width=60% height="auto">

1. **feature_name** e **deature_default_value**: O nome e o valor do recurso booleano que tem False ou True como padrão é inserido nesta linha. Se o recurso não tiver um valor padrão, essa linha não deve ser gravada.

2. **group_name**, **entry_index** e **group_item**: nome do grupo, valor da entrada do índice (geralmente 0) e o item do grupo. Esta linha deve ser inserida para cada item dentro de um grupo.

3. **feature_name** e **procedence_value**: nome do elemento a ser calculado e seu valor de prioridade de resolução. Quanto maior o valor de precedência, maior a prioridade. Ex: em 2 + (3 + 4) a expressão (3 + 4) tem precedência maior que 2 + (). O nome deste recurso será repetido nas linhas 4 e 5.
4. **feat_expression**: resolução da feature de acordo com seu tipo e valores relacionados. Veja exemplos acima:
`ctx.GetInt("mynumber") < 12` no teste 0001.
`result.GetBool("mygroup")` no teste 0003.
`ctx.GetString("gender") == "F"` no teste 0004.
`ctx.GetInt("age") * ctx.GetInt("age") + ""` no teste 0025.
Você pode verificar mais exemplos dentro da pasta de casos de teste.

5. Esta linha salva o resultado na variável features.


### Rodando o teste

Para executar o teste, digite `npx featws-transpiler` no terminal dentro da pasta de teste, e os arquivos de regras serão gerados.

Mostramos como configurar o comando `npx featws-transpiler` no tópico subsequente.

## Usando o npm link

- Quando você usa o `npm link`, você pode trabalhar e testar interativamente sem ter que reconstruir continuamente o projeto. Você pode obter mais informações oficiais sobre o pacote [aqui](https://docs.npmjs.com/cli/v8/commands/npm-link).

- Neste projeto temos que fazer estes passos:

    - Primeiramente, você deve verificar se já possui o pacote featws-transpiler instalado no projeto por este comando no terminal local:

        ~~~shell
        npm list -g featws-transpiler
        ~~~

    - Se estiver instalado, você deve executar este comando para remover o pacote:

        ~~~shell
        npm rm --global featws-transpiler
        ~~~

    - Agora você pode vincular o projeto featws-transpiler fazendo isso:

        ~~~shell
        cd ~/projects/featws-transpiler # go to your project location
        npm link featws-transpiler      # link-install the package
        ~~~

## Usando o npx para rodar os projetos

- O ``npx command`` permite que você execute binários da biblioteca npmjs instalados localmente ou obtidos remotamente, em um contexto semelhante ao executado com ``npm run``. Você pode obter mais informações oficiais sobre o comando [aqui](https://docs.npmjs.com/cli/v8/commands/npx).

- Este comando é muito útil quando você deseja executar, por exemplo, o pacote ``featws-transpiler``, para gerar a transpilação de suas regras para um arquivo ``.grl``

- Depois de terminar a configuração da sua pasta, vá para essa mesma pasta e execute:
     ~~~
        # vá para o local da sua pasta

        cd ~/projects/featws-transpiler/example/simple_group 

        # se você não instalou o pacote, o comando fará isso por você
        # se você já fez, o comando executará o pacote

        npx featws-transpiler
    ~~~
